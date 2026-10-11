import { ColorMode, DuplexMode, PaperSize, OrderType, ShopPricing } from '../types.js';

export interface PriceCalculationParams {
  pageCount: number;
  copies: number;
  colorMode: ColorMode;
  duplexMode: DuplexMode;
  paperSize: PaperSize;
  orderType: OrderType;
}

export function calculateOrderPrice(
  pricing: ShopPricing,
  params: PriceCalculationParams
): { unitPrice: number; totalAmount: number } {
  const { pageCount, copies, colorMode, duplexMode, paperSize, orderType } = params;

  const validPages = Math.max(1, pageCount || 1);
  const validCopies = Math.max(1, copies || 1);

  if (orderType === 'id_card') {
    // ID card per unit price
    const unitPrice = Number(pricing.idCardSinglePrice || 15);
    const totalAmount = unitPrice * validCopies;
    return {
      unitPrice: Number(unitPrice.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
    };
  }

  if (orderType === 'photo' && paperSize === 'Photo4x6') {
    const unitPrice = Number(pricing.photo4x6Price || 20);
    const totalAmount = unitPrice * validCopies;
    return {
      unitPrice: Number(unitPrice.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
    };
  }

  // Document pricing
  let perPageRate = 0;

  if (colorMode === 'bw') {
    if (duplexMode === 'duplex') {
      // Duplex sheet rate (2 pages on 1 sheet)
      // Usually charged per side or duplex discount:
      perPageRate = Number(pricing.bwDuplexPrice || 3.0) / 2;
    } else {
      perPageRate = Number(pricing.bwSinglePrice || 2.0);
    }
  } else {
    if (duplexMode === 'duplex') {
      perPageRate = Number(pricing.colorDuplexPrice || 18.0) / 2;
    } else {
      perPageRate = Number(pricing.colorSinglePrice || 10.0);
    }
  }

  if (paperSize === 'Legal') {
    perPageRate += Number(pricing.legalExtra || 1.0);
  }

  const unitPrice = Number(perPageRate.toFixed(2));
  const totalAmount = Number((perPageRate * validPages * validCopies).toFixed(2));

  return {
    unitPrice,
    totalAmount,
  };
}
