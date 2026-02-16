export type Role = "User" | "Admin";
export type RoomType = "KontorCoworking" | "MotenEvent";

export type RoomImage = {
  id: number;
  bucket: string;
  path: string;
  alt: string;
  sortOrder: number;
  updatedAt: string;
};

export type User = {
  id: number;
  username: string;
  role: Role;
};

export type Room = {
  id: number;
  name: string;
  address: string;
  capacity: number;
  pricePerHour: number;
  squareMeters: number;
  description: string;
  type: RoomType;
  images?: RoomImage[];
};

export type Booking = {
  id: number;
  startTime: string;
  endTime: string;
  roomId: number;
  userId: number;
};
