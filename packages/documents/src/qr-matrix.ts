import { create as createQR } from "qrcode";

export type QRMatrix = {
  size: number;
  get(row: number, col: number): boolean;
};

/** Encode UTF-8 payload to a module matrix (includes quiet zone). */
export function encodeQRMatrix(data: string): QRMatrix {
  const qr = createQR(data, { errorCorrectionLevel: "M" });
  const size = qr.modules.size;
  return {
    size,
    get(row, col) {
      return Boolean(qr.modules.get(row, col));
    },
  };
}

export function qrMatrixToSvg(matrix: QRMatrix, width: number, height: number): string {
  const n = matrix.size;
  if (n <= 0 || width <= 0 || height <= 0) return "";
  const cellW = width / n;
  const cellH = height / n;
  const rects: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix.get(r, c)) continue;
      rects.push(
        `<rect x="${(c * cellW).toFixed(4)}" y="${(r * cellH).toFixed(4)}" width="${cellW.toFixed(4)}" height="${cellH.toFixed(4)}" fill="#000"/>`
      );
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${rects.join("")}</svg>`;
}
