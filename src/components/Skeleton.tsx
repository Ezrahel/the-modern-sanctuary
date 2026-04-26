import React from 'react';
import { motion } from 'motion/react';

export const BookSkeleton = () => {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="aspect-[3/4] bg-surface-container-high rounded-2xl w-full" />
      <div className="space-y-2">
        <div className="h-4 bg-surface-container-high rounded w-3/4" />
        <div className="h-3 bg-surface-container-high rounded w-1/2" />
      </div>
    </div>
  );
};

export const ListSkeleton = ({ count = 5 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <BookSkeleton key={i} />
      ))}
    </div>
  );
};

export const SearchSkeleton = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-4">
          <div className="aspect-[3/4] bg-surface-container-high rounded-2xl w-full" />
          <div className="space-y-3">
            <div className="h-5 bg-surface-container-high rounded w-2/3" />
            <div className="flex justify-between">
              <div className="h-4 bg-surface-container-high rounded w-1/3" />
              <div className="h-4 bg-surface-container-high rounded w-1/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
