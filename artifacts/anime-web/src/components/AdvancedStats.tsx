// components/AdvancedStats.tsx
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart } from 'recharts';
import { Calendar, Clock, TrendingUp, Award, Target, Activity } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';

interface UserStats {
  totalWatchTime: number; // en minutos
  totalEpisodes: number;
  averageRating: number;
  favoriteGenres: Array<{ genre: string; count: number; percentage: number }>;
  watchStreak: {
    current: number;
    longest: number;
    lastWatchDate: Date;
  };
  monthlyActivity: Array<{
    month: string;
    episodes: number;
    hours: number;
    rating: number;
  }>;
  completionRate: number;
  bingeWatchDays: number;
  mostActiveHour: number;
  topRatedAnime: Array<{
    anime_id: string;
    title: string;
    rating: number;
    image: string;
  }>;
}

interface AdvancedStatsProps {
  userId: string;
}

const COLORS = ['#7C6FFF', '#7C73FF', '#8C83FF', '#9C93FF', '#B39DFF', '#B7A3FB'];

export default function AdvancedStats({ userId }: AdvancedStatsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['user-stats-advanced', userId],
    queryFn: () => apiClient.get<UserStats>(`/user/${userId}/advanced-stats`),
    staleTime: 1000 * 60 * 15, // 15 minutos
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-6 animate-pulse">
            <div className="h-4 bg-gray-700 rounded mb-4"></div>
            <div className="h-8 bg-gray-700 rounded mb-2"></div>
            <div className="h-4 bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-white">{formatTime(stats.totalWatchTime)}</p>
              <p className="text-sm text-gray-400">Tiempo total visto</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.totalEpisodes}</p>
              <p className="text-sm text-gray-400">Episodios vistos</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-8 h-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.averageRating.toFixed(1)}</p>
              <p className="text-sm text-gray-400">Calificación promedio</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold text-white">{stats.completionRate}%</p>
              <p className="text-sm text-gray-400">Tasa de completación</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Activity */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-500" />
            Actividad Mensual
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={stats.monthlyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="month" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
              />
              <Area
                type="monotone"
                dataKey="episodes"
                stroke="#7C6FFF"
                fill="#7C6FFF"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Favorite Genres */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Géneros Favoritos</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.favoriteGenres}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="count"
                label={({ genre, percentage }) => `${genre} (${percentage}%)`}
              >
                {stats.favoriteGenres.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Watch Streak */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-500" />
            Racha de Visualización
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Racha actual</span>
              <span className="text-2xl font-bold text-green-500">{stats.watchStreak.current}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Racha más larga</span>
              <span className="text-2xl font-bold text-blue-500">{stats.watchStreak.longest}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Última visualización</span>
              <span className="text-sm text-gray-400">
                {new Date(stats.watchStreak.lastWatchDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Top Rated Anime */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Animes Mejor Calificados</h3>
          <div className="space-y-3">
            {stats.topRatedAnime.map((anime, index) => (
              <div key={anime.anime_id} className="flex items-center gap-3">
                <span className="text-lg font-bold text-purple-500 w-6">#{index + 1}</span>
                <img
                  src={anime.image}
                  alt={anime.title}
                  className="w-10 h-14 object-cover rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{anime.title}</p>
                  <div className="flex items-center gap-1">
                    <span className="text-yellow-500">★</span>
                    <span className="text-sm text-gray-300">{anime.rating}/10</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-orange-500 mb-2">{stats.bingeWatchDays}</div>
          <p className="text-gray-400">Días de maratón</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-cyan-500 mb-2">{stats.mostActiveHour}:00</div>
          <p className="text-gray-400">Hora más activa</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-pink-500 mb-2">
            {Math.round(stats.totalWatchTime / stats.totalEpisodes)}min
          </div>
          <p className="text-gray-400">Promedio por episodio</p>
        </div>
      </div>
    </div>
  );
}