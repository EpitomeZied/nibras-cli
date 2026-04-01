declare module 'gradient-string' {
  interface GradientFunction {
    (text: string): string;
  }
  function gradient(colors: string[]): GradientFunction;
  export = gradient;
}
