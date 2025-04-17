import {useLocation} from 'preact-iso';

export function Header() {
    const {url} = useLocation();

    return (
        <header>
            <nav>
                <a href="/" class={url == '/' && 'active'}>
                    Guild Wars 2 Weapon Analyzer
                </a>
            </nav>
        </header>
    );
}
