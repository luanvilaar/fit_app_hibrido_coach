jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Ícones carregam a fonte de forma assíncrona; nos testes de comportamento o
// desenho do glifo não é relevante e dispararia atualizações fora de `act`.
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("expo-blur", () => {
  const { View } = require("react-native");
  return { BlurView: View };
});
