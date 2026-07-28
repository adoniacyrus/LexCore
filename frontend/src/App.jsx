import './App.css';
import AppRouter from './routes/AppRouter';
import { ModalProvider } from './context/ModalContext';

function App() {
  return (
    <ModalProvider>
      <AppRouter />
    </ModalProvider>
  );
}

export default App;