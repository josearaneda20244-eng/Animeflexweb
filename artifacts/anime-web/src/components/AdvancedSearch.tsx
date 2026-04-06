// components/AdvancedSearch.tsx
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Search as SearchIcon, Filter, X, Star, Calendar, Clock } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface SearchFilters {
  genres: string[];
  status: string;
  year: string;
  season: string;
  type: string;
  minRating: number;
  sortBy: string;
}

interface AdvancedSearchProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  isLoading?: boolean;
}

export default function AdvancedSearch({ onSearch, isLoading }: AdvancedSearchProps) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    genres: [],
    status: '',
    year: '',
    season: '',
    type: '',
    minRating: 0,
    sortBy: 'popularity'
  });

  const debouncedQuery = useDebounce(query, 500);

  useEffect(() => {
    if (debouncedQuery || Object.values(filters).some(v => v && (Array.isArray(v) ? v.length > 0 : true))) {
      onSearch(debouncedQuery, filters);
    }
  }, [debouncedQuery, filters, onSearch]);

  const toggleGenre = (genre: string) => {
    setFilters(prev => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre]
    }));
  };

  const clearFilters = () => {
    setFilters({
      genres: [],
      status: '',
      year: '',
      season: '',
      type: '',
      minRating: 0,
      sortBy: 'popularity'
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Search Input */}
      <div className="relative mb-4">
        <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar anime..."
          className="w-full pl-12 pr-12 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Filter Toggle */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 hover:text-white transition-colors"
        >
          <Filter className="w-4 h-4" />
          Filtros avanzados
          {(filters.genres.length > 0 || filters.status || filters.year) && (
            <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
              {filters.genres.length + (filters.status ? 1 : 0) + (filters.year ? 1 : 0)}
            </span>
          )}
        </button>

        {(filters.genres.length > 0 || filters.status || filters.year) && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-400 hover:text-white"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="bg-gray-800 rounded-xl p-6 mb-6 border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Genres */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Géneros</label>
              <div className="flex flex-wrap gap-2">
                {['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Romance', 'Sci-Fi', 'Horror'].map(genre => (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      filters.genres.includes(genre)
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Estado</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Todos</option>
                <option value="ongoing">En emisión</option>
                <option value="completed">Completado</option>
                <option value="upcoming">Próximamente</option>
              </select>
            </div>

            {/* Year */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Año</label>
              <select
                value={filters.year}
                onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Todos</option>
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Ordenar por</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="popularity">Popularidad</option>
                <option value="rating">Calificación</option>
                <option value="latest">Más reciente</option>
                <option value="oldest">Más antiguo</option>
                <option value="title">Título</option>
              </select>
            </div>

            {/* Min Rating */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Calificación mínima: {filters.minRating > 0 ? `${filters.minRating/10}/10` : 'Todas'}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={filters.minRating}
                onChange={(e) => setFilters(prev => ({ ...prev, minRating: Number(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <p className="text-gray-400 mt-2">Buscando...</p>
        </div>
      )}
    </div>
  );
}