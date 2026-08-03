'use client';

import { DashboardProvider } from './DashboardContext';
import DashboardLayout from './DashboardLayout';

export default function DashboardShell({ children }) {
    return (
        <DashboardProvider>
            <DashboardLayout>
                {children}
            </DashboardLayout>
        </DashboardProvider>
    );
}
