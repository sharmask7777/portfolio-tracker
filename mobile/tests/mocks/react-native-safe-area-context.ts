export const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });
export const SafeAreaProvider = ({ children }: { children: unknown }) => children;
export const SafeAreaView = ({ children }: { children: unknown }) => children;
export default {
  useSafeAreaInsets,
  SafeAreaProvider,
  SafeAreaView,
};
