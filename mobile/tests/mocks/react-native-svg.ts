const createComponent = (name: string) => {
  const Component = (props: Record<string, unknown>) => ({ type: name, props });
  Component.displayName = name;
  return Component;
};

export const Svg = createComponent('Svg');
export const Rect = createComponent('Rect');
export const Circle = createComponent('Circle');
export const Text = createComponent('Text');
export const TSpan = createComponent('TSpan');
export const G = createComponent('G');
export const Path = createComponent('Path');
export const Line = createComponent('Line');
export const Defs = createComponent('Defs');
export const LinearGradient = createComponent('LinearGradient');
export const Stop = createComponent('Stop');

export default Svg;
