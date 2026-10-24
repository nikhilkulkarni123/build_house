"""Formhaus neural site/area and connectivity predictor for the final joint floor-plan decoder.

The frozen neural head supplies room sites/areas plus learned circulation, adjacency probabilities, and approximate door coordinates/orientations. The final API applies a generic balanced joint slicing decoder to those learned signals; no room type receives a preferred side, row or semantic adjacency template.
"""
from __future__ import annotations
import torch
from torch import nn


class ConnectivityRectNet(nn.Module):
    def __init__(self, pad_id: int = 19, max_rooms: int = 8, vocab_size: int = 20):
        super().__init__()
        self.pad_id = pad_id
        self.max_rooms = max_rooms
        self.vocab_size = vocab_size
        d = 96
        self.room = nn.Embedding(vocab_size, d, padding_idx=pad_id)
        self.slot = nn.Embedding(max_rooms, 32)
        self.ent = nn.Embedding(4, 24)
        self.plot = nn.Sequential(nn.Linear(8, 64), nn.SiLU(), nn.Linear(64, 64))
        self.count = nn.Sequential(nn.Linear(1, 16), nn.SiLU(), nn.Linear(16, 16))
        self.node = nn.Sequential(
            nn.Linear(d + 32 + d + 24 + 64 + 16, 320), nn.SiLU(),
            nn.Linear(320, 256), nn.SiLU(),
            nn.Linear(256, 160), nn.SiLU(),
        )
        self.box_head = nn.Linear(160, 4)
        self.passage = nn.Sequential(
            nn.Linear(d + 24 + 64 + 16, 192), nn.SiLU(),
            nn.Linear(192, 128), nn.SiLU(),
            nn.Linear(128, 4),
        )
        self.pair = nn.Sequential(
            nn.Linear(160 * 2 + 8, 192), nn.SiLU(),
            nn.Linear(192, 128), nn.SiLU(),
        )
        self.adj_head = nn.Linear(128, 1)
        self.door_head = nn.Linear(128, 2)
        self.orient_head = nn.Linear(128, 1)

    def forward(self, room_types, room_mask, widths, lengths, entrances):
        batch, slots = room_types.shape
        room_features = self.room(room_types.long())
        active = room_mask.float().unsqueeze(-1)
        global_rooms = (room_features * active).sum(1) / active.sum(1).clamp_min(1)
        slot_features = self.slot(torch.arange(slots, device=room_types.device))[None].expand(batch, -1, -1)

        widths = widths.float().clamp_min(1.0)
        lengths = lengths.float().clamp_min(1.0)
        ratio = (widths / lengths).clamp_min(1e-4)
        log_ratio = torch.log(ratio)
        area = (widths * lengths).clamp_min(1.0)
        plot_features = torch.stack(
            [
                widths / 100.0,
                lengths / 100.0,
                torch.log(widths) / 5.0,
                torch.log(lengths) / 5.0,
                log_ratio,
                torch.sin(log_ratio),
                torch.cos(log_ratio),
                torch.log(area) / 10.0,
            ],
            -1,
        )
        plot_embedding = self.plot(plot_features)
        count_embedding = self.count(room_mask.float().sum(1, keepdim=True) / self.max_rooms)
        entrance_embedding = self.ent(entrances.long())

        node_input = torch.cat(
            [
                room_features,
                slot_features,
                global_rooms[:, None].expand(-1, slots, -1),
                entrance_embedding[:, None].expand(-1, slots, -1),
                plot_embedding[:, None].expand(-1, slots, -1),
                count_embedding[:, None].expand(-1, slots, -1),
            ],
            -1,
        )
        nodes = self.node(node_input)

        raw = self.box_head(nodes)
        size = 0.035 + 0.93 * torch.sigmoid(raw[..., 2:])
        center = torch.sigmoid(raw[..., :2])
        x0 = center[..., 0] * (1 - size[..., 0])
        y0 = center[..., 1] * (1 - size[..., 1])
        boxes = torch.stack([x0, y0, x0 + size[..., 0], y0 + size[..., 1]], -1)

        passage_raw = self.passage(
            torch.cat([global_rooms, entrance_embedding, plot_embedding, count_embedding], -1)
        )
        passage_size = 0.035 + 0.75 * torch.sigmoid(passage_raw[..., 2:])
        passage_center = torch.sigmoid(passage_raw[..., :2])
        px0 = passage_center[..., 0] * (1 - passage_size[..., 0])
        py0 = passage_center[..., 1] * (1 - passage_size[..., 1])
        passage_box = torch.stack(
            [px0, py0, px0 + passage_size[..., 0], py0 + passage_size[..., 1]], -1
        )

        ni = nodes[:, :, None, :].expand(-1, -1, slots, -1)
        nj = nodes[:, None, :, :].expand(-1, slots, -1, -1)
        bi = boxes[:, :, None, :].expand(-1, -1, slots, -1)
        bj = boxes[:, None, :, :].expand(-1, slots, -1, -1)
        pair_features = self.pair(torch.cat([ni, nj, bi, bj], -1))
        adjacency_logits = self.adj_head(pair_features).squeeze(-1)
        door_xy = torch.sigmoid(self.door_head(pair_features))
        door_orientation_logits = self.orient_head(pair_features).squeeze(-1)
        return boxes, passage_box, adjacency_logits, door_xy, door_orientation_logits
