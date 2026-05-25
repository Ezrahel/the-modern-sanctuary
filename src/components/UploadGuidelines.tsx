import React from 'react';
import { Info } from 'lucide-react';
import { UPLOAD_GUIDELINES } from '../lib/uploadLimits';

export const UploadGuidelines: React.FC = () => (
  <div className="mb-6 p-4 rounded-2xl bg-primary/5 border border-primary/15">
    <div className="flex items-start gap-3">
      <Info size={20} className="text-primary shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-charcoal mb-2">Before you upload</p>
        <ul className="text-xs text-secondary space-y-1.5 list-disc pl-4">
          {UPLOAD_GUIDELINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);
