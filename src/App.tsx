import { useAppStore } from './store/useAppStore';
import { MainMenu } from './presentation/screens/MainMenu';
import { SettingsMenu } from './presentation/screens/SettingsMenu';
import { CharacterSelectionMenu } from './presentation/screens/CharacterSelectionMenu';
import { GameScreen } from './presentation/screens/GameScreen';

function App() {
  const currentScreen = useAppStore(s => s.currentScreen);

  return (
    <>
      {currentScreen === 'menu' && <MainMenu />}
      {currentScreen === 'settings' && <SettingsMenu />}
      {currentScreen === 'character-select' && <CharacterSelectionMenu />}
      {currentScreen === 'game' && <GameScreen />}
    </>
  );
}

export default App;
