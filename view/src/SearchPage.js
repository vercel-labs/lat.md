import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { SearchResultCard } from './SearchResultCard';
import { useEffect, useLayoutEffect, useRef, useState, } from 'react';
import { fetchViewJson } from './data-source';
import { searchEscapeAction, searchQuery, searchUrl, } from './navigation';
const SEARCH_DEBOUNCE_MS = 250;
export function SearchPage({ onClose, onNavigate, onScrollRestored, markdownGeneration, restoreScroll, }) {
    const [query, setQuery] = useState(() => searchQuery(window.location.search));
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [error, setError] = useState('');
    const input = useRef(null);
    useEffect(() => {
        input.current?.focus();
    }, []);
    useLayoutEffect(() => {
        if (!restoreScroll)
            return;
        if (query.trim() && !searched && !error)
            return;
        window.scrollTo({ ...restoreScroll, behavior: 'instant' });
        onScrollRestored();
    }, [error, onScrollRestored, query, restoreScroll, searched]);
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key !== 'Escape')
                return;
            event.preventDefault();
            if (searchEscapeAction(query) === 'clear') {
                setQuery('');
            }
            else {
                onClose();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose, query]);
    useEffect(() => {
        const url = searchUrl(query);
        const current = `${window.location.pathname}${window.location.search}`;
        if (url !== current) {
            window.history.replaceState(window.history.state, '', url);
        }
    }, [query]);
    useEffect(() => {
        const normalized = query.trim();
        const controller = new AbortController();
        setError('');
        setSearched(false);
        setLoading(false);
        setResults([]);
        if (!normalized)
            return () => controller.abort();
        const timeout = window.setTimeout(() => {
            setLoading(true);
            void fetchViewJson(`/api/search?query=${encodeURIComponent(normalized)}`, controller.signal)
                .then((response) => {
                setResults(response.results);
                setSearched(true);
            })
                .catch((reason) => {
                if (!controller.signal.aborted)
                    setError(reason.message);
            })
                .finally(() => {
                if (!controller.signal.aborted)
                    setLoading(false);
            });
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [markdownGeneration, query]);
    return (_jsxs("section", { className: "search-page", children: [_jsxs("label", { className: "search-input-shell", children: [_jsxs("svg", { "aria-hidden": "true", viewBox: "0 0 24 24", children: [_jsx("circle", { cx: "11", cy: "11", r: "6.5" }), _jsx("path", { d: "m16 16 4 4" })] }), _jsx("span", { className: "visually-hidden", children: "Search lat.md sections" }), _jsx("input", { autoComplete: "off", onChange: (event) => setQuery(event.currentTarget.value), placeholder: "Search lat.md\u2026", ref: input, spellCheck: "false", type: "search", value: query })] }), _jsxs("div", { "aria-live": "polite", className: "search-status", children: [loading && 'Searching sections…', !loading &&
                        !error &&
                        searched &&
                        results.length > 0 &&
                        `Showing ${results.length} matching sections, ranked by relevance`, !loading && error, !loading &&
                        !error &&
                        searched &&
                        results.length === 0 &&
                        'No matching sections.'] }), results.length > 0 && (_jsx("div", { className: "search-results", children: results.map((result, index) => (_jsx(SearchResultCard, { result: result, rank: index + 1, onNavigate: onNavigate }, result.sectionId))) }))] }));
}
