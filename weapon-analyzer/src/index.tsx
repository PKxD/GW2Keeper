import { render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';

import { Home } from './pages/Home';
import { NotFound } from './pages/_404.jsx';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import './style.css';

export const ROUTER_PREFIX = (new URL(import.meta.url.replace("src/", "").replace("assets/",""))).pathname.match(/.*\//)[0];
export function urlPath(path: string) {
	console.log(ROUTER_PREFIX, );
	return ROUTER_PREFIX + path.replace(/^\//, '');
}


function MainContent(children:any) {
	const theme = useTheme();

	return (
		<main class={theme.themeMode === 'dark' ? 'dark-mode' : ''}>
			{children}
		</main>
	);
}

function ThemeToggle() {
	const { themeMode, toggleTheme } = useTheme();
	return (
		<button
			className="theme-toggle"
			onClick={toggleTheme}
			data-testid="theme-toggle"
		>
			{themeMode === 'dark' ? '☀️ Light' : '🌙 Dark'}
		</button>
	);
}

export function App() {
	return (
		<ThemeProvider>
			<LocationProvider>
				<div className="app-layout">
					<div className="app-header">
						<div className="app-title">
							<span className="app-icon">⚔️</span>
							<span>Guild Wars 2 Weapon Analyzer</span>
						</div>
						<ThemeToggle />
					</div>
					<main>
						<Router>
							<Route path={urlPath("/")} component={Home} />
							<Route default component={NotFound} />
						</Router>
					</main>
				</div>
			</LocationProvider>
		</ThemeProvider>
	);
}

render(<App />, document.getElementById('app'));
