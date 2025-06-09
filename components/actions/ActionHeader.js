import Link from 'next/link';

export default function ActionHeader({ actionName, user }) {
    return (
        <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center py-4">
                    <div className="flex items-center space-x-4">
                        <Link
                            href="/dashboard"
                            className="text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            ← Back
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900 capitalize">
                            {actionName?.replace('-', ' ')} Action
                        </h1>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">
                            {user.name || user.email}
                        </span>
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                                {(user.name || user.email)?.[0]?.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
} 