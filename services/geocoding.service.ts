/**
 * Service de géocodage avec autocomplétion
 * Utilise l'API Nominatim d'OpenStreetMap (gratuite)
 */

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
  address?: {
    road?: string;
    houseNumber?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
}

export interface AutocompleteResult {
  placeId: string;
  displayName: string;
  address: string;
  city: string;
  postcode: string;
  latitude: number;
  longitude: number;
}

class GeocodingService {
  private baseUrl = 'https://nominatim.openstreetmap.org';
  private debounceTimer: NodeJS.Timeout | null = null;

  /**
   * Recherche d'adresses avec autocomplétion
   * @param query Texte de recherche
   * @param countryCode Code pays (fr par défaut)
   */
  async autocompleteAddress(
    query: string,
    countryCode: string = 'fr'
  ): Promise<AutocompleteResult[]> {
    if (!query || query.length < 3) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '5',
        addressdetails: '1',
        countrycodes: countryCode,
      });

      const response = await fetch(`${this.baseUrl}/search?${params}`, {
        headers: {
          'User-Agent': 'RealMeet-App/1.0',
          'Accept-Language': 'fr',
        },
      });

      if (!response.ok) {
        throw new Error('Erreur de recherche');
      }

      const data = await response.json();

      return data.map((item: any) => ({
        placeId: item.place_id.toString(),
        displayName: item.display_name,
        address: this.formatStreetAddress(item.address),
        city: item.address?.city || item.address?.town || item.address?.village || item.address?.municipality || '',
        postcode: item.address?.postcode || '',
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      }));
    } catch (error) {
      console.error('Erreur autocomplétion:', error);
      return [];
    }
  }

  /**
   * Recherche avec debounce pour éviter trop de requêtes
   */
  autocompleteWithDebounce(
    query: string,
    callback: (results: AutocompleteResult[]) => void,
    delay: number = 300
  ): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      const results = await this.autocompleteAddress(query);
      callback(results);
    }, delay);
  }

  /**
   * Formater l'adresse de rue
   */
  private formatStreetAddress(address: any): string {
    if (!address) return '';
    
    const parts: string[] = [];
    
    if (address.house_number) {
      parts.push(address.house_number);
    }
    if (address.road) {
      parts.push(address.road);
    }
    
    return parts.join(' ') || address.display_name?.split(',')[0] || '';
  }

  /**
   * Convertir une adresse en coordonnées GPS
   */
  async geocodeAddress(
    address: string,
    city?: string
  ): Promise<GeocodingResult | null> {
    try {
      const fullAddress = city ? `${address}, ${city}` : address;
      const params = new URLSearchParams({
        q: fullAddress,
        format: 'json',
        limit: '1',
        addressdetails: '1',
      });

      const response = await fetch(`${this.baseUrl}/search?${params}`, {
        headers: {
          'User-Agent': 'RealMeet-App/1.0',
        },
      });

      if (!response.ok) {
        throw new Error('Erreur de géocodage');
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        console.warn('Aucun résultat pour:', fullAddress);
        return null;
      }

      const result = data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        displayName: result.display_name,
        address: {
          road: result.address?.road,
          houseNumber: result.address?.house_number,
          city: result.address?.city || result.address?.town || result.address?.village,
          postcode: result.address?.postcode,
          country: result.address?.country,
        },
      };
    } catch (error) {
      console.error('Erreur de géocodage:', error);
      return null;
    }
  }

  /**
   * Vérifier si des coordonnées sont valides
   */
  areCoordinatesValid(lat?: number, lng?: number): boolean {
    if (lat === undefined || lng === undefined) return false;
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  /**
   * Annuler le debounce en cours
   */
  cancelDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}

export const geocodingService = new GeocodingService();