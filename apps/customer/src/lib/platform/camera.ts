export interface CameraAdapter {
  capture(): Promise<{ dataUrl: string } | null>;
}

const webCamera: CameraAdapter = {
  async capture() {
    return null; // Web uses file input in UI; native replaces this
  },
};

let impl: CameraAdapter = webCamera;

export function setCameraImplementation(next: CameraAdapter) {
  impl = next;
}

export const camera = {
  capture: () => impl.capture(),
};
