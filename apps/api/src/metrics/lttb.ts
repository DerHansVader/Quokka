/**
 * Largest-Triangle-Three-Buckets downsampling.
 * Keeps visual fidelity while reducing point count.
 */
export function lttb(
  data: Array<{ step: number; value: number; wallTime: string }>,
  threshold: number,
): Array<{ step: number; value: number; wallTime: string }> {
  if (data.length <= threshold) return data;

  const sampled: typeof data = [data[0]];
  const bucketSize = (data.length - 2) / (threshold - 2);

  let prevIndex = 0;

  for (let i = 1; i < threshold - 1; i++) {
    const avgStart = Math.floor((i + 0) * bucketSize) + 1;
    const avgEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, data.length);

    let avgStep = 0;
    let avgVal = 0;
    for (let j = avgStart; j < avgEnd; j++) {
      avgStep += data[j].step;
      avgVal += data[j].value;
    }
    avgStep /= avgEnd - avgStart;
    avgVal /= avgEnd - avgStart;

    const rangeStart = Math.floor((i - 1) * bucketSize) + 1;
    const rangeEnd = Math.floor(i * bucketSize) + 1;

    let maxArea = -1;
    let maxIndex = rangeStart;

    for (let j = rangeStart; j < rangeEnd; j++) {
      const area = Math.abs(
        (data[prevIndex].step - avgStep) * (data[j].value - data[prevIndex].value) -
          (data[prevIndex].step - data[j].step) * (avgVal - data[prevIndex].value),
      );
      if (area > maxArea) {
        maxArea = area;
        maxIndex = j;
      }
    }

    sampled.push(data[maxIndex]);
    prevIndex = maxIndex;
  }

  sampled.push(data[data.length - 1]);
  return sampled;
}
