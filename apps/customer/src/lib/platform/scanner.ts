export interface ScannerAdapter {
  scanBarcode(): Promise<string | null>;
}

const webScanner: ScannerAdapter = {
  async scanBarcode() {
    return null;
  },
};

let impl: ScannerAdapter = webScanner;

export function setScannerImplementation(next: ScannerAdapter) {
  impl = next;
}

export const scanner = {
  scanBarcode: () => impl.scanBarcode(),
};
