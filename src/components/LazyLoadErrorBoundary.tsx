import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

class LazyLoadErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("LazyLoadErrorBoundary caught error:", error, errorInfo);

        // Check if the error is a chunk load error
        if (error.message.includes("Failed to fetch dynamically imported module") ||
            error.name === 'ChunkLoadError') {
            console.log("Chunk load error detected. Reloading page to fetch new version...");
            // Reload the page to get the latest index.html and chunks
            // window.location.reload(); // DISABLED FOR DEBUGGING
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-800 p-4 text-center">
                    <div className="text-6xl mb-4">🥴</div>
                    <h1 className="text-2xl font-bold mb-2">אופס! נראה שיש גרסה חדשה למערכת</h1>
                    <p className="text-gray-600 mb-6">אנחנו מרעננים את העמוד כדי לטעון את העדכונים האחרונים...</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg"
                    >
                        רענן עכשיו
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default LazyLoadErrorBoundary;
