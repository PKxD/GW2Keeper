import {useLocation} from 'preact-iso';
import { useTheme } from '../context/ThemeContext';

export function Header() {
    const {url} = useLocation();
    const { themeMode, toggleTheme } = useTheme();

    return (
        <header>
            <nav>
                <a href="/GW2Keeper" class={url == '/' && 'active'}>
                    Guild Wars 2 Weapon Analyzer
                </a>
            </nav>
            <div className="theme-toggle-container">
                <button 
                    className="theme-toggle" 
                    onClick={toggleTheme} 
                    data-testid="theme-toggle"
                >
                    {themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                </button>
            </div>
        </header>
    );
}
