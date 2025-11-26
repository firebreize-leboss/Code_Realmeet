/**
 * Service de géocodage pour convertir des adresses en coordonnées GPS
 * Utilise l'API Nominatim d'OpenStreetMap (gratuite)
 */

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

class GeocodingService {
  private baseUrl = 'https://nominatim.openstreetmap.org/search';

  /**
   * Convertir une adresse en coordonnées GPS
   * @param address Adresse complète (ex: "7 Allée André Malraux, Le Plessis-Trevise 94420")
   * @param city Ville (optionnel, améliore la précision)
   */
  async geocodeAddress(
    address: string,
    city?: string
  ): Promise<GeocodingResult | null> {
    try {
      // Construire la requête
      const fullAddress = city ? `${address}, ${city}` : address;
      const params = new URLSearchParams({
        q: fullAddress,
        format: 'json',
        limit: '1',
        addressdetails: '1',
      });

      // Appel à l'API Nominatim
      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers: {
          'User-Agent': 'RealMeet-App', // Requis par Nominatim
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

      // Extraire les coordonnées
      const result = data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        displayName: result.display_name,
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
}

export const geocodingService = new GeocodingService();