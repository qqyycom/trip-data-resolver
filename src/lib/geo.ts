const PI = Math.PI;
const AXIS = 6378245.0; // 长半轴
const OFFSET = 0.00669342162296594323; // 偏心率平方

function outOfChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
  let ret =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLon(x: number, y: number): number {
  let ret =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

function delta(lng: number, lat: number): { lng: number; lat: number } {
  const dLat = transformLat(lng - 105.0, lat - 35.0);
  const dLon = transformLon(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - OFFSET * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  const adjLat = (dLat * 180.0) / (((AXIS * (1 - OFFSET)) / (magic * sqrtMagic)) * PI);
  const adjLon = (dLon * 180.0) / ((AXIS / sqrtMagic) * Math.cos(radLat) * PI);

  return { lng: adjLon, lat: adjLat };
}

export function wgs84ToGcj02([lng, lat]: [number, number]): [number, number] {
  if (outOfChina(lng, lat)) {
    return [lng, lat];
  }
  const { lng: dLng, lat: dLat } = delta(lng, lat);
  return [lng + dLng, lat + dLat];
}

export function gcj02ToWgs84([lng, lat]: [number, number]): [number, number] {
  if (outOfChina(lng, lat)) {
    return [lng, lat];
  }
  const { lng: dLng, lat: dLat } = delta(lng, lat);
  return [lng - dLng, lat - dLat];
}

export function wgs84PathToGcj(path: [number, number][]): [number, number][] {
  return path.map((point) => wgs84ToGcj02(point));
}

export function gcj02PathToWgs(path: [number, number][]): [number, number][] {
  return path.map((point) => gcj02ToWgs84(point));
}
