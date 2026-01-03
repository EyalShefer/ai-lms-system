import React, { useState } from 'react';
import { IconCopy, IconSchool, IconLink, IconX, IconCheck, IconShare, IconUsers } from '@tabler/icons-react';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    courseId: string;
    courseTitle: string;
    unitTitle?: string; // If sharing a specific unit
    unitId?: string;    // If sharing a specific unit
    initialTab?: ShareTab;
}

type ShareTab = 'link' | 'classroom' | 'collab';

export const ShareModal: React.FC<ShareModalProps> = ({
    isOpen,
    onClose,
    courseId,
    courseTitle,
    unitTitle,
    unitId,
    initialTab = 'link'
}) => {
    const [activeTab, setActiveTab] = useState<ShareTab>(initialTab);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    if (!isOpen) return null;

    const baseUrl = `${window.location.origin}/course/${courseId}/play`;

    // Links configuration
    const links = [
        {
            key: 'universal',
            label: 'Universal Link',
            description: 'Students will see content assigned to them (or all if unspecified).',
            url: unitId ? `${baseUrl}?unit=${unitId}` : baseUrl,
            icon: <IconLink size={18} className="text-blue-500" />
        },
        {
            key: 'support',
            label: 'Support Level',
            description: 'Direct access to Support materials only.',
            url: unitId ? `${baseUrl}?unit=${unitId}&group=support` : `${baseUrl}?group=support`,
            icon: <div className="w-4 h-4 rounded-full bg-green-100 border border-green-400" />
        },
        {
            key: 'core',
            label: 'Core Level',
            description: 'Standard curriculum access.',
            url: unitId ? `${baseUrl}?unit=${unitId}&group=core` : `${baseUrl}?group=core`,
            icon: <div className="w-4 h-4 rounded-full bg-blue-100 border border-blue-400" />
        },
        {
            key: 'enrichment',
            label: 'Enrichment Level',
            description: 'Advanced challenges and extra projects.',
            url: unitId ? `${baseUrl}?unit=${unitId}&group=enrichment` : `${baseUrl}?group=enrichment`,
            icon: <div className="w-4 h-4 rounded-full bg-purple-100 border border-purple-400" />
        }
    ];

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 2000);
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <IconShare className="text-indigo-600" size={24} />
                            Share "{unitTitle ? `${unitTitle} (Activity)` : courseTitle}"
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Generate access links for students or colleagues
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <IconX size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-6 gap-6">
                    <button
                        onClick={() => setActiveTab('link')}
                        className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'link'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <IconLink size={18} /> Student Links
                    </button>
                    <button
                        onClick={() => setActiveTab('classroom')}
                        className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'classroom'
                            ? 'border-green-600 text-green-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <IconSchool size={18} /> Google Classroom
                    </button>
                    <button
                        onClick={() => setActiveTab('collab')}
                        className={`py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'collab'
                            ? 'border-orange-500 text-orange-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <IconUsers size={18} /> Collaborators
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar bg-gray-50/30 flex-1">
                    {activeTab === 'link' && (
                        <div className="space-y-6">
                            {/* Universal Link */}
                            <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                            <IconLink size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-800">Universal Link</h3>
                                            <p className="text-xs text-gray-500">Smart routing based on student login/group</p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded uppercase tracking-wider">
                                        Recommended
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200 group focus-within:ring-2 ring-indigo-200 transition-all">
                                    <input
                                        type="text"
                                        readOnly
                                        value={links[0].url}
                                        className="flex-1 bg-transparent text-sm text-gray-600 font-mono focus:outline-none"
                                    />
                                    <button
                                        onClick={() => copyToClipboard(links[0].url, 'universal')}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${copiedKey === 'universal'
                                            ? 'bg-green-500 text-white'
                                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                            }`}
                                    >
                                        {copiedKey === 'universal' ? <IconCheck size={16} /> : <IconCopy size={16} />}
                                        {copiedKey === 'universal' ? 'Copied' : 'Copy'}
                                    </button>
                                </div>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="w-full border-t border-gray-200"></div>
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="bg-gray-50 px-2 text-sm text-gray-500">Or use direct access links</span>
                                </div>
                            </div>

                            {/* Differentiated Links */}
                            <div className="grid gap-3">
                                {links.slice(1).map(link => (
                                    <div key={link.key} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-50">
                                                {link.icon}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-700">{link.label}</h4>
                                                <p className="text-xs text-gray-400">{link.description}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(link.url, link.key)}
                                            className="text-gray-400 hover:text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition-all"
                                            title="Copy Link"
                                        >
                                            {copiedKey === link.key ? <IconCheck size={18} className="text-green-500" /> : <IconCopy size={18} />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'classroom' && (
                        <div className="flex flex-col items-center justify-center h-48 text-center space-y-4">
                            <div className="p-4 bg-green-50 text-green-600 rounded-full">
                                <IconSchool size={48} />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Google Classroom Integration</h3>
                                <p className="text-sm text-gray-500 max-w-xs mx-auto mt-1">
                                    Connect your classes to assign this {unitTitle ? 'activity' : 'lesson'} directly to your students.
                                </p>
                            </div>
                            <button className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors shadow-sm flex items-center gap-2">
                                Connect Classroom
                            </button>
                        </div>
                    )}

                    {activeTab === 'collab' && (
                        <div className="flex flex-col items-center justify-center h-48 text-center space-y-4">
                            <div className="p-4 bg-orange-50 text-orange-600 rounded-full">
                                <IconUsers size={48} />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Collaborate with Teachers</h3>
                                <p className="text-sm text-gray-500 max-w-xs mx-auto mt-1">
                                    Share a read-only or edit link with colleagues.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 w-full max-w-md bg-white p-2 rounded-lg border border-gray-200">
                                <input
                                    className="flex-1 text-sm bg-transparent outline-none px-2"
                                    value={`${baseUrl}/edit`}
                                    readOnly
                                />
                                <button className="text-indigo-600 font-medium text-sm px-3 hover:bg-indigo-50 rounded py-1">
                                    Copy
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
