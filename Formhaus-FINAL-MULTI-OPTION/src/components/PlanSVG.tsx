import { forwardRef, useId, useMemo } from "react";
import type { FloorPlan, Room } from "../engine/types";
import { getWalls, splitWall } from "../engine/geometry";
import { modelWallSegments, predictionRectangles } from "../engine/model-prediction";
export const dimension = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toFixed(1);
export const PlanSVG = forwardRef<
  SVGSVGElement,
  {
    plan: FloorPlan;
    viewBox?: string;
    selectedRoom?: string;
    onSelect?: (r: Room) => void;
    mini?: boolean;
    labels?: boolean;
  }
>(
  (
    { plan, viewBox, selectedRoom, onSelect, mini = false, labels = true },
    ref,
  ) => {
    const id = useId().replaceAll(":", ""),
      walls = useMemo(
        () =>
          getWalls(plan)
            .flatMap((w) => splitWall(plan, w))
            .filter((w) => w.bottom < 1),
        [plan],
      ),
      predicted = useMemo(() => predictionRectangles(plan), [plan]),
      modelWalls = useMemo(() => modelWallSegments(plan), [plan]);
    const { width, length } = plan.plot;
    if (plan.modelPrediction && !["learned-rectangles", "joint-partition", "joint-partition-multi-option"].includes(plan.modelPrediction.inferenceMode)) {
      const p = plan.modelPrediction;
      return (
        <svg
          ref={ref}
          role="img"
          aria-label={`Trained-model floor-plan prediction, ${width} by ${length} foot plot`}
          viewBox={viewBox || `-7 -7 ${width + 14} ${length + 14}`}
          style={{ width: "100%", height: "100%", display: "block", fontFamily: "Arial, sans-serif", userSelect: "none" }}
        >
          <rect x="-200" y="-200" width="500" height="500" fill="#fafbf8" />
          <rect x="0" y="0" width={width} height={length} fill="#f4f5ef" stroke="#8eaaa0" strokeWidth=".16" />
          {predicted.map((r, i) => (
            <rect
              key={`${r.slot}-${i}`}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              fill={r.colour}
            />
          ))}
          {modelWalls.map((w, i) => (
            <line
              key={`model-wall-${i}`}
              x1={w.x1}
              y1={w.y1}
              x2={w.x2}
              y2={w.y2}
              stroke={w.exterior ? "#173a3b" : "#244346"}
              strokeWidth={w.exterior ? Math.max(.22, plan.wallThickness * .72) : Math.max(.16, plan.wallThickness * .55)}
              strokeLinecap="square"
            />
          ))}
          {labels && !mini && p.roomSlots.filter((slot) => slot.pixels > 0).map((slot) => {
            const room = plan.rooms.find((r) => r.id === `model-room-${slot.slot}`);
            if (!room) return null;
            const labelX = slot.labelX ?? room.x + room.width / 2;
            const labelY = slot.labelY ?? room.y + room.height / 2;
            const labelWidth = Math.max(4.2, Math.min(10, 2.2 + slot.name.length * 0.36));
            return (
              <g key={slot.slot} transform={`translate(${labelX},${labelY})`} textAnchor="middle" pointerEvents="none">
                <rect x={-labelWidth / 2} y="-1.05" width={labelWidth} height="2.1" rx=".45" fill="#ffffff" fillOpacity=".9" stroke="#dfe8e2" strokeWidth=".08" />
                <text y="-.15" fill="#163c3b" fontSize=".68" fontWeight="700">{slot.name}</text>
                <text y=".62" fill="#64807a" fontSize=".48" fontWeight="600">{Math.round(slot.areaSqFt)} sq ft</text>
              </g>
            );
          })}
          {!mini && p.doorMask.map((row, gy) => row.map((v, gx) => {
            if (!v) return null;
            const sx = width / p.plotBox.width, sy = length / p.plotBox.height;
            return <rect key={`door-${gx}-${gy}`} x={(gx-p.plotBox.left)*sx} y={(gy-p.plotBox.top)*sy} width={sx} height={sy} fill="#ad956e" />;
          }))}
          {!mini && (
            <>
              <g stroke="#809d96" strokeWidth=".06" fill="none">
                <path d={`M0 -1.5v-2.5 M${width} -1.5v-2.5 M0 -3H${width} M-1.5 0h-2.5 M-1.5 ${length}h-2.5 M-3 0V${length}`} />
                <g fill="#54736b" stroke="none" fontSize=".9" textAnchor="middle">
                  <text x={width / 2} y="-3.7">{dimension(width)}′–0″</text>
                  <text transform={`translate(-3.8,${length / 2}) rotate(-90)`}>{dimension(length)}′–0″</text>
                </g>
              </g>
              <g fill="#54736b" fontSize=".72">
                <text x="0" y={length + 2.6}>TRAINED MODEL · {p.imageSize}×{p.imageSize} INTERNAL GRID · EPOCH {p.checkpointEpoch}</text>
                <text x="0" y={length + 3.9}>Walls trace the model-predicted room boundaries; no room-placement rules.</text>
              </g>
            </>
          )}
        </svg>
      );
    }
    return (
      <svg
        ref={ref}
        role="img"
        aria-label={`${plan.requirements.bedrooms} BHK ${width} by ${length} foot floor plan, ${plan.plot.entrance} entrance`}
        viewBox={viewBox || `-7 -7 ${width + 14} ${length + 14}`}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          fontFamily: "Arial, sans-serif",
          userSelect: "none",
        }}
      >
        <defs>
          <pattern
            id={"grid-" + id}
            width="1"
            height="1"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 1 0 L 0 0 0 1"
              fill="none"
              stroke="#dce4df"
              strokeWidth=".025"
            />
          </pattern>
          <marker
            id={"arrow-" + id}
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#446b68" />
          </marker>
        </defs>
        <rect x="-200" y="-200" width="500" height="500" fill="#fafbf8" />
        <rect
          x="0"
          y="0"
          width={width}
          height={length}
          fill="#edf0eb"
          stroke="#8eaaa0"
          strokeWidth=".16"
          strokeDasharray=".6 .35"
        />
        <rect x="0" y="0" width={width} height={length} fill={`url(#grid-${id})`} />
        {plan.modelPrediction?.circulation && (
          <g pointerEvents="none">
            <rect
              x={plan.modelPrediction.circulation.x}
              y={plan.modelPrediction.circulation.y}
              width={plan.modelPrediction.circulation.width}
              height={plan.modelPrediction.circulation.height}
              fill={plan.modelPrediction.circulation.colour}
              fillOpacity=".72"
              stroke="#a68d63"
              strokeWidth=".08"
              strokeDasharray=".4 .28"
            />
            {!mini && (
              <text
                x={plan.modelPrediction.circulation.x + plan.modelPrediction.circulation.width / 2}
                y={plan.modelPrediction.circulation.y + .8}
                textAnchor="middle"
                fill="#8a7656"
                fontSize=".56"
                fontWeight="700"
              >
                learned circulation
              </text>
            )}
          </g>
        )}
        {plan.rooms.map((r) => (
          <g
            key={r.id}
            onClick={() => onSelect?.(r)}
            style={{ cursor: onSelect ? "pointer" : undefined }}
          >
            <rect
              data-room-id={r.id}
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              fill={r.colour}
              fillOpacity={selectedRoom === r.id ? 1 : 0.75}
              stroke={selectedRoom === r.id ? "#167b76" : "#bccbc3"}
              strokeWidth={selectedRoom === r.id ? 0.22 : 0.06}
            />
            {r.type === "parking" && (
              <g
                transform={`translate(${r.x + r.width / 2},${r.y + r.height / 2}) rotate(${r.width > r.height ? 90 : 0})`}
                fill="none"
                stroke="#a9b4b0"
                strokeWidth=".12"
              >
                <rect x="-2.6" y="-5.5" width="5.2" height="11" rx="1" />
                <rect x="-2.2" y="-2.9" width="4.4" height="5.2" rx=".5" />
                <path d="M-2.4 -3.7h4.8M-2.4 3.5h4.8" />
              </g>
            )}
            {labels && !mini && (
              <g
                transform={`translate(${r.x + r.width / 2},${r.y + r.height / 2}) ${r.type === "passage" && r.height > r.width ? "rotate(-90)" : ""}`}
                textAnchor="middle"
                pointerEvents="none"
              >
                <text
                  y="-.1"
                  fill="#263f3d"
                  fontSize={
                    r.type === "passage"
                      ? 0.9
                      : Math.min(
                          1.2,
                          (r.width - 0.5) /
                            Math.max(
                              (r.type === "porch" ? 5 : r.name.length) * 0.54,
                              1,
                            ),
                        )
                  }
                  fontWeight="600"
                >
                  {r.type === "porch" ? "Porch" : r.name}
                </text>
                <text y="1.35" fill="#516663" fontSize=".85">
                  {dimension(r.width)}′ × {dimension(r.height)}′
                </text>
              </g>
            )}
          </g>
        ))}
        {!mini && plan.modelPrediction?.adjacencyEdges?.map((edge) => {
          const a = plan.rooms.find((r) => r.id === edge.roomAId);
          const b = plan.rooms.find((r) => r.id === edge.roomBId);
          if (!a || !b) return null;
          return (
            <line
              key={edge.id}
              x1={a.x + a.width / 2}
              y1={a.y + a.height / 2}
              x2={b.x + b.width / 2}
              y2={b.y + b.height / 2}
              stroke="#4d8686"
              strokeWidth=".07"
              strokeDasharray=".22 .24"
              strokeOpacity={Math.min(.52, .18 + edge.probability * .36)}
              pointerEvents="none"
            />
          );
        })}
        {walls.map((w, i) => (
          <rect
            key={i}
            x={w.x - w.width / 2}
            y={w.y - w.depth / 2}
            width={w.width}
            height={w.depth}
            fill="#244346"
          />
        ))}
        {!mini && plan.modelPrediction?.doorCandidates?.map((d) => (
          <g
            key={d.id}
            transform={`translate(${d.x},${d.y}) rotate(${d.orientation === "vertical" ? 90 : 0})`}
            pointerEvents="none"
          >
            <line x1={-d.width / 2} y1="0" x2={d.width / 2} y2="0" stroke="#b47f55" strokeWidth=".16" />
            <circle cx="0" cy="0" r=".22" fill="#fff8ec" stroke="#b47f55" strokeWidth=".08" />
          </g>
        ))}
        {plan.doors
          .filter((d) => d.kind !== "entrance" && d.kind !== "opening")
          .map((d) => (
            <g
              key={d.id}
              transform={`translate(${d.x},${d.y}) rotate(${d.orientation === "vertical" ? 90 : 0})`}
              fill="none"
              stroke="#ad956e"
              strokeWidth=".09"
            >
              <line x1={-d.width / 2} y1="0" x2={-d.width / 2} y2={d.width} />
              <path
                d={`M ${d.width / 2} 0 A ${d.width} ${d.width} 0 0 1 ${-d.width / 2} ${d.width}`}
                strokeDasharray=".15 .08"
              />
            </g>
          ))}
        {plan.windows.map((w) => (
          <g
            key={w.id}
            transform={`translate(${w.x},${w.y}) rotate(${w.orientation === "vertical" ? 90 : 0})`}
            stroke="#469ac2"
            strokeWidth=".1"
          >
            <line x1={-w.width / 2} y1="-.12" x2={w.width / 2} y2="-.12" />
            <line x1={-w.width / 2} y1=".12" x2={w.width / 2} y2=".12" />
            <line x1={-w.width / 2} y1="-.22" x2={-w.width / 2} y2=".22" />
            <line x1={w.width / 2} y1="-.22" x2={w.width / 2} y2=".22" />
          </g>
        ))}
        {!mini && (
          <g stroke="#809d96" strokeWidth=".06" fill="none">
            <path
              d={`M0 -1.5v-2.5 M${width} -1.5v-2.5 M0 -3H${width} M-1.5 0h-2.5 M-1.5 ${length}h-2.5 M-3 0V${length}`}
            />
            <g fill="#54736b" stroke="none" fontSize=".9" textAnchor="middle">
              <text x={width / 2} y="-3.7">
                {width}′–0″
              </text>
              <text transform={`translate(-3.8,${length / 2}) rotate(-90)`}>
                {length}′–0″
              </text>
            </g>
          </g>
        )}
        {!mini &&
          plan.doors
            .filter((d) => d.kind === "entrance")
            .map((d) => {
              const offset =
                plan.plot.entrance === "West"
                  ? [-3.8, 0]
                  : plan.plot.entrance === "East"
                    ? [3.8, 0]
                    : plan.plot.entrance === "North"
                      ? [0, -3.8]
                      : [0, 3.8];
              return (
                <g key={d.id}>
                  <path
                    d={`M${d.x + offset[0]} ${d.y + offset[1]}L${d.x + offset[0] * 0.15} ${d.y + offset[1] * 0.15}`}
                    stroke="#1e8178"
                    strokeWidth=".23"
                    markerEnd={`url(#arrow-${id})`}
                  />
                  <text
                    x={d.x + offset[0]}
                    y={
                      d.y +
                      offset[1] +
                      (offset[0] ? 1.3 : offset[1] > 0 ? 1.2 : -0.8)
                    }
                    textAnchor="middle"
                    fill="#23776e"
                    fontSize=".72"
                  >
                    ENTRY
                  </text>
                </g>
              );
            })}
        {!mini && plan.modelPrediction?.coverage && (
          <g transform={`translate(0,${length + 2.45})`} fontSize=".62" fill="#60766f">
            <rect x="0" y="-.55" width="1.1" height=".55" fill="#f1eee7" stroke="#a68d63" strokeWidth=".06" />
            <text x="1.45" y="-.08">learned circulation</text>
            <rect x="8.8" y="-.55" width="1.1" height=".55" fill="#edf0eb" stroke="#aab5b0" strokeWidth=".06" />
            <text x="10.25" y="-.08">joint coverage {((1 - plan.modelPrediction.coverage.residualShare) * 100).toFixed(0)}%</text>
            <circle cx="20.8" cy="-.27" r=".18" fill="#fff8ec" stroke="#b47f55" strokeWidth=".07" />
            <text x="21.35" y="-.08">learned door candidate</text>
          </g>
        )}
        {!mini && (
          <g transform={`translate(${width - 1.4},${length + 3.6})`}>
            <path d="M0 -1.5L-.5 .3L0 0L.5 .3Z" fill="#294c47" />
            <text x="1.2" y="0" fontSize=".8" fill="#294c47">
              N
            </text>
          </g>
        )}
      </svg>
    );
  },
);
PlanSVG.displayName = "PlanSVG";
