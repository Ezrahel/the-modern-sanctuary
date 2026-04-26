import { Book, User, Star, Clock, Download, ChevronRight, Search, Upload, Quote, Edit3, TrendingUp, Globe, Mail } from 'lucide-react';

export type Screen = 'home' | 'library' | 'search' | 'detail' | 'upload' | 'about';

export interface BookType {
  id: string;
  title: string;
  author: string;
  cover: string;
  category: string;
  rating?: number;
  pages?: number;
  format?: string;
  uploader?: string;
  description?: string;
  timeAgo?: string;
  dateAdded: string; // ISO format
}

export const BOOKS: BookType[] = [
  {
    id: '1',
    title: 'The Sacred Rhythm: Walking with Christ',
    author: 'Jonathan P. Silas',
    category: 'Christian Living',
    cover: 'https://images.unsplash.com/photo-1519781542704-957ff19eff00?auto=format&fit=crop&q=80&w=800',
    rating: 4.9,
    pages: 312,
    format: 'EPUB, PDF',
    uploader: 'CommunityChoice',
    description: 'A profound exploration of finding sacred rhythm in an age of constant noise. Discover the transformative power of walking with Christ through prayer and contemplation.',
    dateAdded: '2026-01-15T10:00:00Z'
  },
  {
    id: '2',
    title: 'Shadows of Grace',
    author: 'Marcus V. Sterling',
    category: 'Theology',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC691ht-QFxMQmdCpT6PiuCeUSWelsGIJ8A1XvTXNOv-jmHdLsNrHyGYvMX7Iv30VNRLU_2E5kILgysmrICBWYvHT69sQEjFkkOyuZBfGEnlhqcmpEuQqw3HJlHLoFfMHwZ4YFh2tXCQOsEUo0ufISwC67svMl-i__RmamFix5KKOi35kZTG2LPpVAVvc1IsPorV1SVwBLixKKdooH8qO5BpdaGnL8YUkkpzxVfAeMcdXmXuXoPtVKP-Lnhtaa9i0-pI426kJ67NGKE',
    rating: 4.5,
    format: 'PDF',
    dateAdded: '2026-02-10T14:30:00Z'
  },
  {
    id: '3',
    title: 'The Liturgy of Work',
    author: 'Dr. Sarah Jenkins',
    category: 'Christian Living',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBOEPazHCRSYiAiAGNyYMuFl08IcN6fHQgWXteMrhRvjeqcHjaJql-58aZdhWffBpU1Bn5wMoodOPUb6E9aKRlREX1ByKCqz4AEy882L73MI6X1Ujp0jbMLlPTEwNcjYOu8rP0Nz5v6LyCNuoOvrBaa7wYYhfj4z8c2GCdmnIqm8seZPFZaDUUB-_w_q_cvP-sGE3N7drO4zyjr4Pytdye4Z2cnsPxuRyXuBmVnS3w4RaVwMDPyNtvIxXXoL6aCG2F0F_Hiet5Q28CS',
    rating: 4.7,
    format: 'EPUB',
    dateAdded: '2026-03-05T09:15:00Z'
  },
  {
    id: '4',
    title: 'Unbound Hope',
    author: 'Julia Rivers',
    category: 'Philosophy',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCiK11jQURlmWaaYTxNmjECpGZV9PYwdxmIBKNlfcddB8027ICaa2aDoRlAYRV_8gsbeCDWf49zHduPK810RGusiiTKNpjTpKVjv8kWcxMeIZs--6Sq0sG3wiRUcw8mUESkVIPfiWC-RJBRz36o6PGTC9o3p73AD_Cq3G0n-DZAXxyibkDruTn7xnCvtAlgdoLkIX5FzK7tGzFB82f4F-qkyFlGXLrV-awEXTQOFGQeBVavz3K3NUui-QkAo1ZH5V_zWwfPcmvyPTm9',
    rating: 4.2,
    format: 'MOBI',
    dateAdded: '2026-03-20T16:45:00Z'
  },
  {
    id: '5',
    title: 'City of Priests',
    author: 'Rev. Thomas Kaine',
    category: 'History',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCpqmKTzMlL6TUY6-96PnMIeTcyrgct3NO4AJLaEa8J9xSeFYGx08x4ihjho8gS6uQJT-4TdZVhr5CuTk3iCezC27DpLIVMkvlYeqw6i9N3A6hPPDBrd3NAGRadMyYDdyInW5iUjTWe0wsdr4N7Wf-J-GEQ6s4rXxd4CzjG2VfPLbVIIXLQOMZATCIQ9f3T4SAW8ZiktS8JLjIS4fVA7fsgDglunse4_5pltQowEC04DrgZZ1Fnn0v5eUSr-aCVL4hayF7qY3u8K5FQ',
    rating: 4.8,
    format: 'EPUB, PDF',
    dateAdded: '2026-04-01T11:20:00Z'
  },
  {
    id: '6',
    title: 'Ancient Paths',
    author: 'Catherine de Grace',
    category: 'Biblical Studies',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD8HxUYRK7gWPXia5fZpmHz0z7nFurOicsIuisguE1ze_cdoo2tf7U591Bcb4bzvF1j9CfNJfV1ERra3jK-wsAjbihrdf8VIW5qY4H0973bbF6P6ycpMjM4_vLqRe7feQIvDP-0QJ-9S8ptOMNelLaSrLY3UqFWNbhFCw6DZy7uYTzCwnQkw084-Wvn3nBAn29y03bXShyqRHpnvyHWJmwC5qTVyFEsYF88p9ckaoye89furjpMan8R17VNMSAemoYatM0Q6nKCczHt',
    rating: 4.6,
    format: 'DOCS',
    dateAdded: '2026-04-05T13:10:00Z'
  },
  {
    id: '7',
    title: 'The Silent Path',
    author: 'Thomas A. Merton',
    category: 'Philosophy',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAPlh27Ezz9SUBFETUVlE9MHLq-AkaNSmYECAlUO-3oXI0W7p_kS9Y0fYVzSbTvSTb3Qr5-Zb5qvcwNzzqIuqahHLEKoqiDNI-9jq7ECmsIRRFFope8fMRxvrqJSFrVib12Gh7aByYJDqRTO_qWClBK4yt_QI7mMMCSgkugStlp8wJu2OkymDklwQpUBm49aH9s3ZHfz7_fHXB2YqYVkAq0-1xLiP7aew4IxgXGdBg-Q3uI9GJe0LLpT30NB-E3Q_yvJpnogDwJuqVN',
    rating: 5.0,
    format: 'EPUB',
    dateAdded: '2026-04-10T10:00:00Z'
  },
  {
    id: '8',
    title: 'Morning Anchors',
    author: 'Sarah Jenkins',
    category: 'Devotionals',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCxqyuZ97YWTwdRVKE5eDEg8atxH9W6eFmhRAsPLp5UsdMek164nit_IZ8iZXu3ZxQAqifTtlvEKwASQedLgZ2sPvJBouJ-K0Mtk4VTsvh-CSW-u3To8VPeMV9wTjfu9lfjAJDK9r309uXvotZAmoiwMW74rudMl1iQJlXFIxbowYMb_-4yTfQErqPIzainwyEBP6-xxXDapwQ5CwKSbxvtH3IkiXnWJq4wGjBmdq4LKH7po2aoEw0B8ZKdQJzQDRrg27ysnT6kZI8d',
    rating: 4.4,
    format: 'MOBI',
    dateAdded: '2026-04-15T08:30:00Z'
  },
  {
    id: '9',
    title: 'Echoes of Grace',
    author: 'David Lindholm',
    category: 'Theology',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAzsmVWyt3g2M0BbRxc13vouX4228ya-tptzPBrNoW5mrSamKFaI_1UffOO0z1dJn6LZxqngEeyycMQ8uW2kCBcvwnm3fZ7tk0cfr6p0I98ZS7dO0pBu5H3SIBttB24rIHsXE1qoCIJAjf7RjGGQtftnIRyPPMMY_pswYKiBboGdqPs4wW5xFZocmjH7RieS1e4e8gxRzJynYBK00dCKqXVO_tTFUXBRh50bi11DQqInNi0NaPMCHj2dCUJpPdkOVr_MVf3ehy1KAl5',
    rating: 4.3,
    format: 'PDF',
    dateAdded: '2026-04-18T15:20:00Z'
  },
  {
    id: '10',
    title: 'The Urban Saint',
    author: 'Michael Chen',
    category: 'Biographies',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBRVjZR9c0XmyNasil1mcdtATZRw92JF-qssWoVEGndOShvvo48N-PA5gwrtwxeHZoDTiJ6rhApzmJUgCHBhw27VGenCuDK-NgGnUFzT9h1eT-9gtZ4vJrUbjhVqr2MBbK6pDWLlkVjnzgnyR27Urtb1AuTUCmfSwvae5WyrMGz50V6NFdB6dejZY6JwDcUsaKABmgfqMUi4X-oJ7l4oNAjJHsAU6a8Az0C1p0jrSp6lsLwH3Q_EPuBnX_4AdgemMqrZAHy6YMB7oTD',
    rating: 4.1,
    format: 'EPUB',
    dateAdded: '2026-04-20T12:00:00Z'
  },
  {
    id: '11',
    title: 'The Silent Echo',
    author: 'Julian Thorne',
    category: 'Philosophy',
    cover: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDbxlRAe5A8ImWb9OWEVaTn4JXsf61mC3s3ccVad-Hasyc25nyu9-Nw7UwSr0XdL0b-sXbNKdf4wAaz_WEK7yCJx4amEDLuuSWiHqZzhjguDOJk0jAUcPLDw6S4BkyqgaYYr_O0TuZdFikkg9U4VwlxMNtlVQhtS6eK7MnH9XlqmrzFJHOtTCYwzA3EQsnlrKEB4tUjpeDnLeYpvFb0u-jK8nsbCHvz6v_89fxR9moRPyeB947yKOiUFvYa5HalDjSQD7G5lfMnj4DS',
    rating: 4.9,
    pages: 342,
    format: 'EPUB, PDF',
    uploader: 'ZenReader_99',
    description: 'In "The Silent Echo," Julian Thorne explores the profound intersection of ancient contemplative practices and the relentless pace of the modern digital age. This work serves as both a philosophical treatise and a practical guide.',
    dateAdded: '2026-04-22T09:00:00Z'
  }
];

export const CATEGORIES = ['Theology', 'Christian Living', 'Biblical Studies', 'History', 'Fiction', 'Devotionals', 'Biographies', 'Philosophy', 'Philosophy & Spirituality'];
export const FORMATS = ['EPUB', 'PDF', 'MOBI', 'DOCS', 'DOCX'];
