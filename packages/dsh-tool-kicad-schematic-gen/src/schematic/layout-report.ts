/** Report planned frame conflicts without moving geometry or inferring connectivity. */
import type { ResolvedFlatFrame, FlatPoint } from './flat.ts'
import type { FlatBounds } from './flat-layout.ts'
import { overlap } from './power-layout.ts'

export interface FrameLayoutIssue {
  code: 'FRAME_OVERLAP' | 'FRAME_OUTSIDE_PAGE'
  frame: string
  bounds: FlatBounds
  otherFrame?: string
  otherBounds?: FlatBounds
}

export function inspectFrameLayout(frames: ResolvedFlatFrame[], pageSize: FlatPoint) {
  const issues: FrameLayoutIssue[] = []
  const boxes = frames.map(frame => ({ left: frame.start[0], top: frame.start[1], right: frame.end[0], bottom: frame.end[1] }))
  for (const [i, frame] of frames.entries()) {
    const bounds = boxes[i]!
    if (bounds.left < 0 || bounds.top < 0 || bounds.right > pageSize[0] || bounds.bottom > pageSize[1]) {
      issues.push({ code: 'FRAME_OUTSIDE_PAGE', frame: frame.name, bounds })
    }
    for (let j = i + 1; j < frames.length; j++) {
      if (overlap(bounds, boxes[j]!)) issues.push({ code: 'FRAME_OVERLAP', frame: frame.name,
        bounds, otherFrame: frames[j]!.name, otherBounds: boxes[j]! })
    }
  }
  return { pageSize, total: issues.length, issues }
}
