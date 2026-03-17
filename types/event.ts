// types/event.ts
export interface IEvent {
  title: string;
  date: Date;
  time?: string;
  location?: string;
  description: string;
  year: string;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// For creating a new event (omit auto-generated fields)
export interface IEventInput {
  title: string;
  date: Date | string;
  time?: string;
  location?: string;
  description: string;
  year: string;
  expiresAt?: Date | string;
  isActive?: boolean;
}

// For updating an event (all fields optional)
export interface IEventUpdate {
  title?: string;
  date?: Date | string;
  time?: string;
  location?: string;
  description?: string;
  year?: string;
  expiresAt?: Date | string;
  isActive?: boolean;
}

// For event filters/queries
export interface IEventFilters {
  year?: string;
  isActive?: boolean;
  startDate?: Date | string;
  endDate?: Date | string;
  search?: string;
}

// For API responses
export interface IEventResponse {
  success: boolean;
  data?: IEvent | IEvent[];
  message?: string;
  error?: string;
}

// For paginated responses
export interface IEventPaginatedResponse {
  success: boolean;
  data: IEvent[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

// For event statistics
export interface IEventStats {
  totalEvents: number;
  activeEvents: number;
  expiredEvents: number;
  eventsByYear: Record<string, number>;
  upcomingEvents: number;
  pastEvents: number;
}
