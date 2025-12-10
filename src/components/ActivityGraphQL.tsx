'use client';

import React, { useState, useEffect } from 'react';
import { usePerformanceData } from '@/hooks/usePerformanceData';
import { useActivityData, getMockActivityData } from '@/hooks/useActivityData';
import Image from 'next/image';
import { useMockData } from '@/components/ClientProviders';

const ActivityGraphQL = () => {
  const { loading } = usePerformanceData();
  const { activities, loading: activitiesLoading } = useActivityData(15);
  const { useMock } = useMockData();
  const [timeRemaining, setTimeRemaining] = useState({ hours: 1, minutes: 25 });

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59 };
        }
        return { hours: 1, minutes: 25 }; // Reset countdown
      });
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Decide which list to show based on global mock toggle
  const displayActivities = useMock ? getMockActivityData() : activities;
  const showEmpty = !activitiesLoading && (!displayActivities || displayActivities.length === 0);

  if (loading) {
    return (
      <div className="bg-gray1 border border-gray3 text-primary rounded-lg h-full overflow-hidden">
        <div className="p-6 flex justify-between items-center">
          <h2 className="text-base font-semibold text-primary">Activity</h2>
          <div className="text-xs leading-[1.5] text-gray5 flex items-center justify-end text-right">
            <span>Rebalancing in {timeRemaining.hours}h {timeRemaining.minutes}m</span>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-2"></div>
          </div>
        </div>
        <div className="p-4 flex items-center justify-center h-32">
          <div className="text-secondary">Loading activity...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray1 border border-gray3 text-primary rounded-lg overflow-hidden h-full flex flex-col">
      {/* Desktop Layout */}
      <div className="hidden md:flex flex-col h-full">
        {/* Header with countdown */}
        <div className="p-6 flex justify-between items-center">
          <h2 className="text-base font-semibold text-primary">Activity</h2>
          <div className="text-xs leading-[1.5] text-gray5 flex items-center justify-end text-right">
            <span>Rebalancing in {timeRemaining.hours}h {timeRemaining.minutes}m</span>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-2"></div>
          </div>
        </div>

        {/* Activity List - No borders, clean design */}
        <div className="flex-1 p-4 pt-0 overflow-y-auto max-h-80">
          {activitiesLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-secondary">Loading activity...</div>
            </div>
          ) : showEmpty ? (
            <div className="relative flex flex-col h-full">
              {/* Ghost rows (exact layout: icon + two muted bars of varying widths) */}
              <div className="space-y-4 px-6 pt-2">
                {[
                  { w: [112, 36], icon: '/rebalance.svg' },
                  { w: [100, 44], icon: '/deposit.svg' },
                  { w: [108, 28], icon: '/harvest.svg' }
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 flex items-center justify-center opacity-30">
                      <Image src={row.icon} alt="placeholder" width={16} height={16} className="filter brightness-0 invert" />
                    </div>
                    <div className="flex items-center gap-3 opacity-20">
                      <div className="h-2 bg-gray3 rounded" style={{ width: row.w[0] }} />
                      <div className="h-2 bg-gray3 rounded" style={{ width: row.w[1] }} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Centered caption overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-xs text-gray5">No deposits yet…</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {displayActivities.map((activity, index) => (
                <div key={activity.id || index} className="flex items-start space-x-3">
                  <div className="w-6 h-6 flex items-center justify-center mt-0.5 flex-shrink-0">
                    <Image
                      src={activity.icon}
                      alt={activity.type.toLowerCase()}
                      width={16}
                      height={16}
                      className="filter brightness-0 invert"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-secondary leading-relaxed">
                      {activity.title}
                      {activity.description && (
                        <span className="text-tertiary"> {activity.description}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-tertiary">{activity.timeAgo}</p>
                      {activity.transactionHash && (
                        <a
                          href={`https://basescan.org/tx/${activity.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          View Tx
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Header with countdown */}
        <div className="p-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-primary">Activity</h2>
          <div className="text-xs leading-[1.5] text-gray5 flex items-center justify-end text-right">
            <span>Rebalancing in {timeRemaining.hours}h {timeRemaining.minutes}m</span>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse ml-2"></div>
          </div>
        </div>
        
        {/* Mobile Activity List */}
        <div className="p-4 pt-0">
          {activitiesLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-secondary">Loading activity...</div>
            </div>
          ) : showEmpty ? (
            <div className="relative flex flex-col h-full">
              <div className="space-y-4 px-6 pt-2">
                {[
                  { w: [112, 36], icon: '/rebalance.svg' },
                  { w: [100, 44], icon: '/deposit.svg' },
                  { w: [108, 28], icon: '/harvest.svg' }
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 flex items-center justify-center opacity-30">
                      <Image src={row.icon} alt="placeholder" width={16} height={16} className="filter brightness-0 invert" />
                    </div>
                    <div className="flex items-center gap-3 opacity-20">
                      <div className="h-2 bg-gray3 rounded" style={{ width: row.w[0] }} />
                      <div className="h-2 bg-gray3 rounded" style={{ width: row.w[1] }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-xs text-gray5">No deposits yet…</div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {displayActivities.map((activity, index) => (
                <div key={activity.id || index} className="flex items-center space-x-3 py-2">
                  <div className="w-8 h-8 bg-gray3 rounded-full flex items-center justify-center flex-shrink-0">
                    <Image
                      src={activity.icon}
                      alt={activity.type.toLowerCase()}
                      width={16}
                      height={16}
                      className="filter brightness-0 invert"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary leading-tight">
                      {activity.title}
                      {activity.description && (
                        <span className="text-secondary"> {activity.description}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-tertiary">{activity.timeAgo}</p>
                      {activity.transactionHash && (
                        <a
                          href={`https://basescan.org/tx/${activity.transactionHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          Tx
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityGraphQL;