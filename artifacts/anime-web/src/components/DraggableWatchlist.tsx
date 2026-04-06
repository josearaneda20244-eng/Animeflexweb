// components/DraggableWatchlist.tsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GripVertical, Play, Star, Calendar, Clock, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { resolveTitle } from '@/lib/consumet';
import { useWatchList, type WatchStatus, type WatchListEntry } from '@/context/WatchListContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';

const STATUS_CONFIG: Record<WatchStatus, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  watching: {
    label: 'Viendo',
    icon: <Play size={16} fill="currentColor" />,
    color: '#6C63FF',
    bgColor: 'rgba(108, 99, 255, 0.1)'
  },
  completed: {
    label: 'Completado',
    icon: <CheckCircle2 size={16} />,
    color: '#22C55E',
    bgColor: 'rgba(34, 197, 94, 0.1)'
  },
  plan_to_watch: {
    label: 'Pendiente',
    icon: <Clock size={16} />,
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.1)'
  },
  dropped: {
    label: 'Abandonado',
    icon: <XCircle size={16} />,
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.1)'
  }
};

interface DraggableWatchlistProps {
  status: WatchStatus;
  onStatusChange?: (animeId: string, newStatus: WatchStatus) => void;
  onRemove?: (animeId: string) => void;
  className?: string;
}

export default function DraggableWatchlist({
  status,
  onStatusChange,
  onRemove,
  className = ''
}: DraggableWatchlistProps) {
  const [, navigate] = useLocation();
  const { getByStatus, setStatus } = useWatchList();
  const [items, setItems] = useState<WatchListEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setItems(getByStatus(status));
  }, [getByStatus, status]);

  const handleDragEnd = (result: DropResult) => {
    setIsDragging(false);

    if (!result.destination) {
      return;
    }

    const reorderedItems = Array.from(items);
    const [removed] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, removed);

    setItems(reorderedItems);

    // Aquí podrías guardar el nuevo orden en el backend si es necesario
    // Por ahora solo mantenemos el orden local
  };

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleStatusChange = (animeId: string, newStatus: WatchStatus) => {
    if (onStatusChange) {
      onStatusChange(animeId, newStatus);
    } else {
      // Buscar el anime en la lista actual
      const anime = items.find(item => item.anime.id === animeId)?.anime;
      if (anime) {
        setStatus(anime, newStatus);
      }
    }
  };

  const handleRemove = (animeId: string) => {
    if (onRemove) {
      onRemove(animeId);
    } else {
      // Buscar el anime y removerlo
      const anime = items.find(item => item.anime.id === animeId)?.anime;
      if (anime) {
        setStatus(anime, null);
      }
    }
  };

  const config = STATUS_CONFIG[status];

  if (items.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <div className="text-6xl mb-4 opacity-20" style={{ color: config.color }}>
          {config.icon}
        </div>
        <h3 className="text-xl font-semibold text-muted-foreground mb-2">
          No hay animes en {config.label.toLowerCase()}
        </h3>
        <p className="text-muted-foreground">
          Agrega animes a tu lista para organizarlos aquí
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-3 mb-6">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: config.bgColor, color: config.color }}
        >
          {config.icon}
        </div>
        <div>
          <h2 className="text-2xl font-bold">{config.label}</h2>
          <p className="text-muted-foreground">
            {items.length} anime{items.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
        <Droppable droppableId={`watchlist-${status}`}>
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`space-y-3 transition-colors ${
                snapshot.isDraggingOver ? 'bg-accent/50 rounded-lg p-4' : ''
              }`}
            >
              {items.map((item, index) => (
                <Draggable
                  key={item.anime.id}
                  draggableId={item.anime.id}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <Card
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`transition-all duration-200 ${
                        snapshot.isDragging
                          ? 'shadow-2xl rotate-2 scale-105'
                          : 'hover:shadow-md'
                      } ${isDragging && !snapshot.isDragging ? 'opacity-50' : ''}`}
                      style={{
                        ...provided.draggableProps.style,
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Drag Handle */}
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded"
                          >
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                          </div>

                          {/* Anime Image */}
                          <div
                            className="relative w-16 h-24 rounded-lg overflow-hidden cursor-pointer flex-shrink-0"
                            onClick={() => navigate(`/anime/${item.anime.id}`)}
                          >
                            <img
                              src={item.anime.image}
                              alt={resolveTitle(item.anime.title)}
                              className="w-full h-full object-cover hover:scale-110 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
                          </div>

                          {/* Anime Info */}
                          <div className="flex-1 min-w-0">
                            <h3
                              className="font-semibold text-lg truncate cursor-pointer hover:text-primary transition-colors"
                              onClick={() => navigate(`/anime/${item.anime.id}`)}
                            >
                              {resolveTitle(item.anime.title)}
                            </h3>

                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              {item.anime.type && (
                                <Badge variant="secondary" className="text-xs">
                                  {item.anime.type}
                                </Badge>
                              )}

                              {item.anime.rating != null && item.anime.rating > 0 && (
                                <div className="flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                  <span className="text-xs font-medium">
                                    {(item.anime.rating / 10).toFixed(1)}
                                  </span>
                                </div>
                              )}

                              {item.anime.totalEpisodes && (
                                <span className="text-xs">
                                  {item.anime.totalEpisodes} EP
                                </span>
                              )}

                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span className="text-xs">
                                  {new Date(item.addedAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 mt-3">
                              {/* Status Selector */}
                              <select
                                value={item.status}
                                onChange={(e) => handleStatusChange(item.anime.id, e.target.value as WatchStatus)}
                                className="text-xs bg-background border border-border rounded px-2 py-1"
                              >
                                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                                  <option key={key} value={key}>
                                    {config.label}
                                  </option>
                                ))}
                              </select>

                              {/* Remove Button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemove(item.anime.id)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}