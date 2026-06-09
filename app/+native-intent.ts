type NativeIntentInput = {
  path: string;
  initial: boolean;
};

export function redirectSystemPath({ path }: NativeIntentInput) {
  return path;
}
