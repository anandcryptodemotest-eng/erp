export interface BiometricAdapter {
  isAvailable(): Promise<boolean>;
  authenticate(reason?: string): Promise<boolean>;
}

const stub: BiometricAdapter = {
  async isAvailable() {
    return false;
  },
  async authenticate() {
    return false;
  },
};

let impl: BiometricAdapter = stub;

export function setBiometricImplementation(next: BiometricAdapter) {
  impl = next;
}

export const biometric = {
  isAvailable: () => impl.isAvailable(),
  authenticate: (reason?: string) => impl.authenticate(reason),
};
