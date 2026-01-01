import { prisma } from "@/config/database";
import { User, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { BCRYPT_SALT_ROUNDS } from "@/constants/constants";
import { RegisterDto, UserUpdateDto } from "@/types";
import { logAudit } from "./activity-log.service";

export class UserService {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async findByEmployeeId(employeeId: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { employeeId },
    });
  }

  async findBymobile(mobile: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { mobile },
    });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  public async create(data: RegisterDto): Promise<User> {
    const hashedPassword = await this.hashPassword(data.password);

    const userData: any = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      employeeId: data.employeeId || `EMP${Date.now()}`,
      mobile: data.mobile,
      password: hashedPassword,
    };

    if (data.role) {
      userData.role = data.role;
      if (data.role === "ADMIN" && data.companyName) {
        userData.companyName = data.companyName;
      }
    }

    // Add birthday if provided - handle string conversion
    if (data.birthday) {
      const birthdayString = String(data.birthday).trim();
      if (birthdayString) {
        const birthdayDate = new Date(birthdayString);
        
        // Validate it's a valid date
        if (!isNaN(birthdayDate.getTime())) {
          userData.birthday = birthdayDate;
        } else {
          console.warn('⚠️ Invalid birthday format, skipping:', data.birthday);
        }
      }
    }

    console.log('Creating user with data:', {
      ...userData,
      password: '[REDACTED]'
    });

    return await prisma.user.create({
      data: userData,
    });
  }

  public async createWithLog(
    actorId: string,
    data: RegisterDto
  ): Promise<User> {
    const user = await this.create(data);
    await logAudit(prisma, {
      actorUserId: actorId,
      action: "USER_CREATED",
      entityType: "USER",
      entityId: user.id,
      metadata: { email: user.email },
      message: `Created user ${user.email}`,
    });
    return user;
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
  }): Promise<User[]> {
    return prisma.user.findMany(params);
  }

  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return prisma.user.count({ where });
  }

  async updateById(id: string, data: Partial<User>): Promise<User | null> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async updateByIdWithLog(
    actorId: string,
    id: string,
    data: Partial<User>
  ): Promise<User | null> {
    const user = await this.updateById(id, data);
    if (user) {
      await logAudit(prisma, {
        actorUserId: actorId,
        action: "USER_UPDATED",
        entityType: "USER",
        entityId: id,
        message: `Updated user ${id}`,
      });
    }
    return user;
  }

  async updateProfile(id: string, data: UserUpdateDto): Promise<User | null> {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  async updateProfileWithLog(
    userId: string,
    data: UserUpdateDto
  ): Promise<User | null> {
    const user = await this.updateProfile(userId, data);
    if (user) {
      await logAudit(prisma, {
        actorUserId: userId,
        action: "USER_PROFILE_UPDATED",
        entityType: "USER",
        entityId: userId,
        message: `Updated profile for user ${userId}`,
      });
    }
    return user;
  }

  async addRefreshToken(userId: string, refreshToken: string): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokens: {
          push: refreshToken,
        },
        lastLogin: new Date(),
      },
    });
  }

  async removeRefreshToken(
    userId: string,
    refreshToken: string
  ): Promise<User> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const updatedTokens = user.refreshTokens.filter(
      (token) => token !== refreshToken
    );

    return prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokens: updatedTokens,
      },
    });
  }

  async clearAllRefreshTokens(userId: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        refreshTokens: [],
      },
    });
  }

  async deactivate(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async deactivateWithLog(actorId: string, id: string): Promise<User> {
    const user = await this.deactivate(id);
    await logAudit(prisma, {
      actorUserId: actorId,
      action: "USER_DEACTIVATED",
      entityType: "USER",
      entityId: id,
      message: `Deactivated user ${id}`,
    });
    return user;
  }

  async delete(id: string): Promise<User> {
    return prisma.user.delete({
      where: { id },
    });
  }

  async deleteWithLog(actorId: string, id: string): Promise<User> {
    const user = await this.delete(id);
    await logAudit(prisma, {
      actorUserId: actorId,
      action: "USER_DELETED",
      entityType: "USER",
      entityId: id,
      message: `Deleted user ${id}`,
    });
    return user;
  }

  async comparePassword(
    plainPassword: string,
    hashedPassword: string
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    return bcrypt.hash(password, salt);
  }

  // Transform user for JSON response (exclude password and refreshTokens)
  transformUser(user: User): Omit<User, "password" | "refreshTokens"> {
    const { password, refreshTokens, ...userWithoutSensitiveData } = user;
    return userWithoutSensitiveData;
  }
}

export default new UserService();
