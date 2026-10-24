"""Door-conditioned floor-plan segmentation model reproduced from the training notebook."""
import math
import torch
from torch import nn
import torch.nn.functional as F


class DoorConvBlock(nn.Module):
    def __init__(self, in_channels: int, out_channels: int):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Conv2d(in_channels, out_channels, 3, padding=1),
            nn.GroupNorm(8, out_channels),
            nn.SiLU(),
            nn.Conv2d(out_channels, out_channels, 3, padding=1),
            nn.GroupNorm(8, out_channels),
            nn.SiLU(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.layers(x)


class DoorFloorNet(nn.Module):
    """Exact architecture used by floorregion_door_best.pt in the notebook."""

    def __init__(self, pad_id: int = 13, max_rooms: int = 8):
        super().__init__()
        self.pad_id = pad_id
        self.max_rooms = max_rooms
        self.enc1 = DoorConvBlock(4, 32)
        self.enc2 = DoorConvBlock(32, 64)
        self.enc3 = DoorConvBlock(64, 128)
        self.middle = DoorConvBlock(128, 192)
        self.dec3 = DoorConvBlock(192 + 128, 128)
        self.dec2 = DoorConvBlock(128 + 64, 64)
        self.dec1 = DoorConvBlock(64 + 32, 64)
        self.pixel_features = nn.Conv2d(64, 96, 1)
        self.background = nn.Conv2d(64, 1, 1)
        self.room_embedding = nn.Embedding(pad_id + 1, 96, padding_idx=pad_id)
        self.slot_embedding = nn.Embedding(max_rooms, 96)
        self.plot_context = nn.Linear(192, 96)
        transformer_layer = nn.TransformerEncoderLayer(
            d_model=96,
            nhead=4,
            dim_feedforward=192,
            dropout=0.1,
            batch_first=True,
        )
        self.room_transformer = nn.TransformerEncoder(transformer_layer, num_layers=2)
        self.room_kernel = nn.Linear(96, 96)
        self.room_bias = nn.Linear(96, 1)

    def forward(
        self, images: torch.Tensor, room_types: torch.Tensor, room_mask: torch.Tensor
    ) -> torch.Tensor:
        batch_size, channels, height, width = images.shape
        if channels != 2:
            raise ValueError("Expected plot and door channels")

        coordinates = torch.linspace(
            -1, 1, height, device=images.device, dtype=images.dtype
        )
        yy, xx = torch.meshgrid(coordinates, coordinates, indexing="ij")
        xx = xx[None, None].expand(batch_size, 1, height, width)
        yy = yy[None, None].expand(batch_size, 1, height, width)
        x = torch.cat([images, xx, yy], dim=1)

        e1 = self.enc1(x)
        e2 = self.enc2(F.avg_pool2d(e1, 2))
        e3 = self.enc3(F.avg_pool2d(e2, 2))
        middle = self.middle(F.avg_pool2d(e3, 2))
        d3 = self.dec3(torch.cat([
            F.interpolate(middle, size=e3.shape[-2:], mode="bilinear", align_corners=False),
            e3,
        ], dim=1))
        d2 = self.dec2(torch.cat([
            F.interpolate(d3, size=e2.shape[-2:], mode="bilinear", align_corners=False),
            e2,
        ], dim=1))
        d1 = self.dec1(torch.cat([
            F.interpolate(d2, size=e1.shape[-2:], mode="bilinear", align_corners=False),
            e1,
        ], dim=1))

        slot_ids = torch.arange(room_types.shape[1], device=room_types.device)
        context = self.plot_context(middle.mean(dim=(2, 3)))[:, None, :]
        queries = (
            self.room_embedding(room_types)
            + self.slot_embedding(slot_ids)[None, :, :]
            + context
        )
        queries = self.room_transformer(
            queries, src_key_padding_mask=~room_mask.bool()
        )
        features = self.pixel_features(d1)
        kernels = self.room_kernel(queries)
        biases = self.room_bias(queries).squeeze(-1)
        room_logits = (
            torch.einsum("bchw,brc->brhw", features, kernels)
            / math.sqrt(features.shape[1])
            + biases[:, :, None, None]
        )
        room_logits = room_logits.masked_fill(
            ~room_mask.bool()[:, :, None, None], -1e4
        )
        return torch.cat([self.background(d1), room_logits], dim=1)
