import React from 'react';
import { motion } from 'motion/react';
import { Download, BookOpen } from 'lucide-react';
import { BookType } from '../constants';

interface BookCardProps {
  book: BookType;
  onClick: () => void;
  showOverlay?: boolean;
  progress?: number;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onClick, showOverlay = false, progress = 0 }) => {
  return (
    <motion.div 
      className="group cursor-pointer"
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
    >
      <div className="relative aspect-[2/3] bg-white rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] overflow-hidden mb-4 border border-surface-container-high transition-shadow group-hover:shadow-xl">
        <img 
          src={book.cover} 
          alt={book.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        
        {progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20 backdrop-blur-md">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-primary"
            />
          </div>
        )}

        {showOverlay && (
          <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6 gap-2">
            <button className="w-full bg-white text-charcoal py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform text-sm">
              <Download size={16} />
              Download PDF
            </button>
            <button className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform text-sm">
              <BookOpen size={16} />
              Read Online
            </button>
          </div>
        )}
      </div>
      <h3 className="font-semibold text-charcoal truncate text-base leading-tight">{book.title}</h3>
      <p className="text-secondary text-sm font-medium mt-1">{book.author}</p>
    </motion.div>
  );
};
