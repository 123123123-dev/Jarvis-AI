import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
	for (const key of Object.keys(sessionStorage)) {
		if (key.startsWith('jarvis_')) sessionStorage.removeItem(key);
	}
} catch {
	// Storage may be unavailable in restricted browser contexts.
}

createRoot(document.getElementById('root')!).render(<App />);
