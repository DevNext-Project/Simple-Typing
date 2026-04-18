function StatsCard({ icon, label, value, unit, className }) {
    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-4 transition-colors duration-300" data-name="stats-card" data-file="components/StatsCard.js">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-slate-700 text-[var(--primary-color)]">
                <div className={`icon-${icon} text-xl`}></div>
            </div>
            <div>
                <div className="text-sm text-[var(--text-muted)] font-medium mb-1">{label}</div>
                <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-bold font-mono ${className || 'text-[var(--text-main)]'}`}>{value}</span>
                    {unit && <span className="text-sm text-[var(--text-muted)] font-medium">{unit}</span>}
                </div>
            </div>
        </div>
    );
}

window.StatsCard = StatsCard;
