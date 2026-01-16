import { prisma } from "@/config/database";

const DEFAULT_KEY = "default";

export type PaymentSettingsDTO = {
  accountName: string;
  gcashMobile: string;
  gcashQrCodeUrl: string | null;
};

export class PaymentSettingsService {
  static async getOrCreateDefault(): Promise<PaymentSettingsDTO> {
    const settings = await prisma.paymentSettings.upsert({
      where: { key: DEFAULT_KEY },
      update: {},
      create: {
        key: DEFAULT_KEY,
        accountName: "4B'S TRAVEL AND TOURS",
        gcashMobile: "09946311233",
        gcashQrCodeUrl: null,
      },
    });

    return {
      accountName: settings.accountName,
      gcashMobile: settings.gcashMobile,
      gcashQrCodeUrl: settings.gcashQrCodeUrl ?? null,
    };
  }

  static async updateDefault(input: {
    accountName?: string;
    gcashMobile?: string;
    gcashQrCodeUrl?: string | null;
  }): Promise<PaymentSettingsDTO> {
    const settings = await prisma.paymentSettings.upsert({
      where: { key: DEFAULT_KEY },
      update: {
        ...(input.accountName !== undefined
          ? { accountName: input.accountName }
          : {}),
        ...(input.gcashMobile !== undefined
          ? { gcashMobile: input.gcashMobile }
          : {}),
        ...(input.gcashQrCodeUrl !== undefined
          ? { gcashQrCodeUrl: input.gcashQrCodeUrl }
          : {}),
      },
      create: {
        key: DEFAULT_KEY,
        accountName: input.accountName ?? "4B'S TRAVEL AND TOURS",
        gcashMobile: input.gcashMobile ?? "09946311233",
        gcashQrCodeUrl:
          input.gcashQrCodeUrl === undefined ? null : input.gcashQrCodeUrl,
      },
    });

    return {
      accountName: settings.accountName,
      gcashMobile: settings.gcashMobile,
      gcashQrCodeUrl: settings.gcashQrCodeUrl ?? null,
    };
  }
}
