'use client';

import { useState } from 'react';

export default function SublinkWorker() {
  const [inputValue, setInputValue] = useState('');
  const [advancedOptions, setAdvancedOptions] = useState(false);

  const handleConvert = () => {
    // Conversion logic will be implemented later
  };

  const handleClear = () => {
    setInputValue('');
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <h1 className="text-4xl font-semibold text-center mb-8 bg-gradient-to-r from-purple-600 to-blue-500 text-white py-6 rounded-lg">
        Sublink Worker
      </h1>

      {/* Main Content */}
      <div className="bg-white rounded-lg p-6 shadow-lg">
        {/* Share Link Section */}
        <div className="mb-6">
          <h2 className="text-lg mb-2">分享链接</h2>
          <textarea
            className="w-full h-32 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="在此输入您的订阅链接..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        </div>

        {/* Advanced Options */}
        <div className="mb-6 flex items-center">
          <div className="flex items-center">
            <div
              className={`w-12 h-6 rounded-full p-1 cursor-pointer ${
                advancedOptions ? 'bg-purple-600' : 'bg-gray-300'
              }`}
              onClick={() => setAdvancedOptions(!advancedOptions)}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${
                  advancedOptions ? 'translate-x-6' : ''
                }`}
              />
            </div>
            <span className="ml-3 text-gray-700">高级选项</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleConvert}
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-500 text-white py-3 px-6 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            转换
          </button>
          <button
            onClick={handleClear}
            className="px-6 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="ml-2">清除</span>
          </button>
        </div>
      </div>
    </div>
  );
} 