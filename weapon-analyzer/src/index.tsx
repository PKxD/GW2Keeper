import { render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';

import { Header } from '@components/Header';
import { Home } from './pages/Home';
import { NotFound } from './pages/_404.jsx';
import {ThemeProvider, useTheme} from './context/ThemeContext';
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

export function App() {
	return (
		<ThemeProvider>
			<LocationProvider>
				<Header />
				<main>
					<Router>
						<Route path={urlPath("/")} component={Home} />
						<Route default component={NotFound} />
					</Router>
				</main>
			</LocationProvider>
		</ThemeProvider>
	);
}

render(<App />, document.getElementById('app'));
