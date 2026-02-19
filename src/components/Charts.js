'use client';

import { useMemo, useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    PointElement,
    LineElement,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
    aggregateByDate, aggregateByWeek, aggregateByMonth,
    aggregateByDateWithTags, aggregateByWeekWithTags, aggregateByMonthWithTags,
    aggregateByTag, formatMinutes, minutesToDecimalHours,
} from '@/lib/klogParser';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    PointElement,
    LineElement,
);

const TAG_COLORS = [
    '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#3b82f6', '#14b8a6', '#f97316',
    '#a855f7', '#22d3ee', '#84cc16', '#e11d48', '#0ea5e9',
];

const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false,
        },
        tooltip: {
            backgroundColor: 'rgba(18, 20, 30, 0.95)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            titleColor: '#f0f1f5',
            bodyColor: '#8b8fa3',
            padding: 12,
            cornerRadius: 8,
            titleFont: { family: 'Inter', weight: '600' },
            bodyFont: { family: 'Inter' },
        },
    },
    scales: {
        x: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { color: '#5a5e72', font: { family: 'Inter', size: 11 } },
        },
        y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: {
                color: '#5a5e72',
                font: { family: 'Inter', size: 11 },
                callback: (v) => v + 'h',
            },
        },
    },
};

export default function Charts({ records, config }) {
    const [timeMode, setTimeMode] = useState('daily');
    const [showTags, setShowTags] = useState(false);

    const dailyData = useMemo(() => aggregateByDate(records), [records]);
    const weeklyData = useMemo(() => aggregateByWeek(records), [records]);
    const monthlyData = useMemo(() => aggregateByMonth(records), [records]);
    const tagData = useMemo(() => aggregateByTag(records), [records]);

    const dailyTagData = useMemo(() => aggregateByDateWithTags(records), [records]);
    const weeklyTagData = useMemo(() => aggregateByWeekWithTags(records), [records]);
    const monthlyTagData = useMemo(() => aggregateByMonthWithTags(records), [records]);

    const timeData = timeMode === 'daily' ? dailyData :
        timeMode === 'weekly' ? weeklyData : monthlyData;

    const timeTagData = timeMode === 'daily' ? dailyTagData :
        timeMode === 'weekly' ? weeklyTagData : monthlyTagData;

    const labelKey = timeMode === 'daily' ? 'date' :
        timeMode === 'weekly' ? 'week' : 'month';

    const targetHours = config?.dailyTargetHours || 8.0;

    // Build stacked datasets when showTags is true
    const stackedChartData = useMemo(() => {
        if (!showTags || timeTagData.length === 0) return null;

        // Collect all unique tags across all periods, sorted by total hours descending
        const tagTotals = {};
        for (const period of timeTagData) {
            for (const [tag, mins] of Object.entries(period.tagBreakdown)) {
                if (!tagTotals[tag]) tagTotals[tag] = 0;
                tagTotals[tag] += mins;
            }
        }
        const sortedTags = Object.entries(tagTotals)
            .sort(([, a], [, b]) => b - a)
            .map(([tag]) => tag);

        const labels = timeTagData.map(d => {
            const val = d.key;
            if (timeMode === 'daily' && val) return val.slice(5);
            if (timeMode === 'weekly' && val) return 'W ' + val.slice(5);
            return val;
        });

        const datasets = sortedTags.map((tag, i) => ({
            label: '#' + tag,
            data: timeTagData.map(d => {
                const mins = d.tagBreakdown[tag] || 0;
                return minutesToDecimalHours(mins);
            }),
            backgroundColor: TAG_COLORS[i % TAG_COLORS.length] + 'cc',
            borderColor: TAG_COLORS[i % TAG_COLORS.length],
            borderWidth: 1,
            borderRadius: 2,
        }));

        return { labels, datasets };
    }, [showTags, timeTagData, timeMode]);

    const barChartData = showTags && stackedChartData ? stackedChartData : {
        labels: timeData.map(d => {
            const val = d[labelKey];
            if (timeMode === 'daily' && val) return val.slice(5); // MM-DD
            if (timeMode === 'weekly' && val) return 'W ' + val.slice(5);
            return val;
        }),
        datasets: [{
            label: 'Hours',
            data: timeData.map(d => d.hours),
            backgroundColor: 'rgba(99, 102, 241, 0.6)',
            borderColor: 'rgba(99, 102, 241, 1)',
            borderWidth: 1,
            borderRadius: 4,
            hoverBackgroundColor: 'rgba(99, 102, 241, 0.8)',
            order: 2,
        },
        ],
    };

    const barChartOptions = {
        ...chartDefaults,
        plugins: {
            ...chartDefaults.plugins,
            legend: {
                display: showTags,
                position: 'top',
                labels: {
                    color: '#8b8fa3',
                    font: { family: 'Inter', size: 10 },
                    padding: 8,
                    usePointStyle: true,
                    pointStyle: 'rect',
                    boxWidth: 10,
                },
            },
            tooltip: {
                ...chartDefaults.plugins.tooltip,
                mode: showTags ? 'index' : 'nearest',
                callbacks: {
                    label: (ctx) => {
                        const val = ctx.parsed.y;
                        if (showTags && val === 0) return null;
                        return showTags ? ` ${ctx.dataset.label}: ${val.toFixed(2)}h` : `${val.toFixed(2)}h`;
                    },
                },
            },
        },
        scales: {
            ...chartDefaults.scales,
            x: {
                ...chartDefaults.scales.x,
                stacked: showTags,
            },
            y: {
                ...chartDefaults.scales.y,
                stacked: showTags,
            },
        },
    };

    const trendChartData = {
        labels: dailyData.map(d => d.date.slice(5)),
        datasets: [{
            label: 'Hours',
            data: dailyData.map(d => d.hours),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: '#6366f1',
            pointBorderColor: 'transparent',
            pointHoverRadius: 6,
            pointHoverBackgroundColor: '#6366f1',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
        }],
    };

    const doughnutData = {
        labels: tagData.slice(0, 10).map(d => '#' + d.tag),
        datasets: [{
            data: tagData.slice(0, 10).map(d => d.hours),
            backgroundColor: TAG_COLORS.slice(0, 10).map(c => c + 'cc'),
            borderColor: TAG_COLORS.slice(0, 10),
            borderWidth: 2,
            hoverOffset: 6,
        }],
    };

    return (
        <div className="charts-grid animate-slide-up">
            {/* Time Bar Chart */}
            <div className="chart-card">
                <div className="chart-header">
                    <h3 className="chart-title">Time Overview</h3>
                    <div className="chart-toggle">
                        {['daily', 'weekly', 'monthly'].map(mode => (
                            <button
                                key={mode}
                                className={timeMode === mode ? 'active' : ''}
                                onClick={() => setTimeMode(mode)}
                            >
                                {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                        ))}
                        <label
                            onClick={() => setShowTags(v => !v)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '12px',
                                color: showTags ? '#f0f1f5' : 'var(--text-muted)',
                                cursor: 'pointer',
                                marginLeft: '10px',
                                userSelect: 'none',
                                transition: 'color 0.2s',
                            }}
                        >
                            <span style={{
                                position: 'relative',
                                width: '32px',
                                height: '18px',
                                borderRadius: '9px',
                                background: showTags
                                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                    : 'rgba(255, 255, 255, 0.1)',
                                transition: 'background 0.25s ease',
                                boxShadow: showTags ? '0 0 8px rgba(99, 102, 241, 0.4)' : 'none',
                                flexShrink: 0,
                            }}>
                                <span style={{
                                    position: 'absolute',
                                    top: '2px',
                                    left: showTags ? '16px' : '2px',
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '50%',
                                    background: '#fff',
                                    transition: 'left 0.25s ease',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                }} />
                            </span>
                            Tags
                        </label>
                    </div>
                </div>
                <div className="chart-container">
                    <Bar data={barChartData} options={barChartOptions} />
                </div>
            </div>

            {/* Tag Distribution */}
            <div className="chart-card">
                <div className="chart-header">
                    <h3 className="chart-title">Tag Distribution</h3>
                </div>
                <div className="chart-container">
                    <Doughnut data={doughnutData} options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: true,
                                position: 'right',
                                labels: {
                                    color: '#8b8fa3',
                                    font: { family: 'Inter', size: 11 },
                                    padding: 8,
                                    usePointStyle: true,
                                    pointStyle: 'circle',
                                },
                            },
                            tooltip: {
                                ...chartDefaults.plugins.tooltip,
                                callbacks: {
                                    label: (ctx) => {
                                        const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                        const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                                        return ` ${ctx.parsed.toFixed(2)}h (${pct}%)`;
                                    },
                                },
                            },
                        },
                    }} />
                </div>
            </div>

            {/* Trend Line */}
            <div className="chart-card full-width">
                <div className="chart-header">
                    <h3 className="chart-title">Daily Trend</h3>
                </div>
                <div className="chart-container" style={{ height: '220px' }}>
                    <Line data={trendChartData} options={{
                        ...chartDefaults,
                        plugins: {
                            ...chartDefaults.plugins,
                            tooltip: {
                                ...chartDefaults.plugins.tooltip,
                                callbacks: {
                                    label: (ctx) => `${ctx.parsed.y.toFixed(2)}h`,
                                },
                            },
                        },
                    }} />
                </div>
            </div>

            {/* Tag Breakdown Table */}
            <div className="chart-card full-width">
                <div className="chart-header">
                    <h3 className="chart-title">Tag Breakdown</h3>
                </div>
                <div className="tag-breakdown">
                    {tagData.slice(0, 15).map((item, i) => {
                        const maxHours = tagData[0]?.hours || 1;
                        const pct = (item.hours / maxHours) * 100;
                        return (
                            <div key={item.tag} className="tag-breakdown-item">
                                <span className="tag-breakdown-name">#{item.tag}</span>
                                <div className="tag-breakdown-bar">
                                    <div
                                        className="tag-breakdown-fill"
                                        style={{
                                            width: `${pct}%`,
                                            background: TAG_COLORS[i % TAG_COLORS.length],
                                        }}
                                    />
                                </div>
                                <span className="tag-breakdown-value">{item.hours.toFixed(2)}h</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
