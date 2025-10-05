var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// Modern React with TypeScript
import React, { useEffect, useRef } from 'react';
const ModernComponent = ({ onCopy }) => {
    const abortControllerRef = useRef();
    useEffect(() => {
        // Set up AbortController
        abortControllerRef.current = new AbortController();
        // Fetch data with abort signal
        fetchData('/api/data', abortControllerRef.current.signal)
            .then(data => console.log('Data loaded:', data))
            .catch(error => {
            if (error.name !== 'AbortError') {
                console.error('Fetch error:', error);
            }
        });
        return () => {
            var _a;
            (_a = abortControllerRef.current) === null || _a === void 0 ? void 0 : _a.abort();
        };
    }, []);
    const handleCopy = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield navigator.clipboard.writeText('Copied text');
            onCopy === null || onCopy === void 0 ? void 0 : onCopy('Copied text');
        }
        catch (err) {
            console.error('Clipboard error:', err);
        }
    });
    const handleFetch = () => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const response = yield fetch('/api/data');
            const data = yield response.json();
            console.log('Fetched:', data);
        }
        catch (error) {
            console.error('Fetch failed:', error);
        }
    });
    return (<div className="grid-container">
      <header className="item:has(.icon)">
        <button onClick={handleCopy}>Copy Text</button>
        <button onClick={handleFetch}>Fetch Data</button>
      </header>
      <main>
        <p>Modern React component with advanced features</p>
      </main>
    </div>);
};
function fetchData(url, signal) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetch(url, { signal });
        return response.json();
    });
}
export default ModernComponent;
