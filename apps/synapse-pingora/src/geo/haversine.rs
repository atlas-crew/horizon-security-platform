//! Haversine formula for great-circle distance calculation.
//!
//! Calculates the shortest distance between two points on Earth's surface,
//! following the curvature of the Earth (great-circle distance).

use std::f64::consts::PI;

use super::types::EARTH_RADIUS_KM;

/// Calculate the great-circle distance between two points using the Haversine formula.
///
/// The Haversine formula determines the shortest distance between two points
/// on a sphere given their latitudes and longitudes. This is more accurate
/// than Euclidean distance for geographic calculations.
///
/// # Arguments
///
/// * `lat1` - Latitude of first point in degrees (-90 to 90)
/// * `lon1` - Longitude of first point in degrees (-180 to 180)
/// * `lat2` - Latitude of second point in degrees (-90 to 90)
/// * `lon2` - Longitude of second point in degrees (-180 to 180)
///
/// # Returns
///
/// Distance in kilometers.
///
/// # Examples
///
/// ```
/// use synapse_pingora::geo::haversine_distance;
///
/// // New York to London: ~5570 km
/// let distance = haversine_distance(40.7128, -74.0060, 51.5074, -0.1278);
/// assert!((distance - 5570.0).abs() < 50.0);
/// ```
#[inline]
pub fn haversine_distance(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    // Convert degrees to radians
    let lat1_rad = lat1 * PI / 180.0;
    let lat2_rad = lat2 * PI / 180.0;
    let delta_lat = (lat2 - lat1) * PI / 180.0;
    let delta_lon = (lon2 - lon1) * PI / 180.0;

    // Haversine formula:
    // a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
    // c = 2 * atan2(√a, √(1−a))
    // d = R * c
    let a = (delta_lat / 2.0).sin().powi(2)
        + lat1_rad.cos() * lat2_rad.cos() * (delta_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().asin();

    EARTH_RADIUS_KM * c
}

/// Validate that geographic coordinates are within valid ranges.
///
/// Checks that:
/// - Latitude is in range [-90, 90]
/// - Longitude is in range [-180, 180]
/// - Neither value is NaN or infinite
///
/// # Arguments
///
/// * `lat` - Latitude to validate
/// * `lon` - Longitude to validate
///
/// # Returns
///
/// `true` if coordinates are valid, `false` otherwise.
///
/// # Examples
///
/// ```
/// use synapse_pingora::geo::is_valid_coordinates;
///
/// assert!(is_valid_coordinates(40.7128, -74.0060)); // NYC
/// assert!(!is_valid_coordinates(91.0, 0.0)); // Invalid latitude
/// assert!(!is_valid_coordinates(0.0, 181.0)); // Invalid longitude
/// assert!(!is_valid_coordinates(f64::NAN, 0.0)); // NaN
/// ```
#[inline]
pub fn is_valid_coordinates(lat: f64, lon: f64) -> bool {
    // Check for NaN or infinite values
    if !lat.is_finite() || !lon.is_finite() {
        return false;
    }
    // Validate coordinate ranges
    (-90.0..=90.0).contains(&lat) && (-180.0..=180.0).contains(&lon)
}

/// Calculate the required travel speed between two locations.
///
/// # Arguments
///
/// * `distance_km` - Distance in kilometers
/// * `time_diff_hours` - Time difference in hours
///
/// # Returns
///
/// Required speed in km/h, or `f64::INFINITY` for zero/negative time.
#[inline]
pub fn calculate_speed(distance_km: f64, time_diff_hours: f64) -> f64 {
    if time_diff_hours <= 0.0 {
        f64::INFINITY
    } else {
        distance_km / time_diff_hours
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // Known city coordinates for testing
    const NYC: (f64, f64) = (40.7128, -74.0060);
    const LONDON: (f64, f64) = (51.5074, -0.1278);
    const TOKYO: (f64, f64) = (35.6762, 139.6503);
    const LA: (f64, f64) = (34.0522, -118.2437);
    const SYDNEY: (f64, f64) = (-33.8688, 151.2093);

    #[test]
    fn test_haversine_nyc_to_london() {
        let distance = haversine_distance(NYC.0, NYC.1, LONDON.0, LONDON.1);
        // Expected: ~5570 km
        assert!(
            (distance - 5570.0).abs() < 50.0,
            "NYC to London should be ~5570 km, got {distance}"
        );
    }

    #[test]
    fn test_haversine_same_location() {
        let distance = haversine_distance(NYC.0, NYC.1, NYC.0, NYC.1);
        assert_eq!(distance, 0.0, "Same location should have 0 distance");
    }

    #[test]
    fn test_haversine_antipodal() {
        // Opposite sides of Earth (~20015 km at equator)
        let distance = haversine_distance(0.0, 0.0, 0.0, 180.0);
        assert!(
            (distance - 20015.0).abs() < 50.0,
            "Antipodal points should be ~20015 km apart, got {distance}"
        );
    }

    #[test]
    fn test_haversine_la_to_tokyo() {
        let distance = haversine_distance(LA.0, LA.1, TOKYO.0, TOKYO.1);
        // Expected: ~8815 km
        assert!(
            (distance - 8815.0).abs() < 50.0,
            "LA to Tokyo should be ~8815 km, got {distance}"
        );
    }

    #[test]
    fn test_haversine_nyc_to_sydney() {
        let distance = haversine_distance(NYC.0, NYC.1, SYDNEY.0, SYDNEY.1);
        // Expected: ~15989 km
        assert!(
            (distance - 15989.0).abs() < 100.0,
            "NYC to Sydney should be ~15989 km, got {distance}"
        );
    }

    #[test]
    fn test_haversine_short_distance() {
        // Times Square to Empire State Building (~0.8 km)
        let distance = haversine_distance(40.7580, -73.9855, 40.7484, -73.9857);
        assert!(
            distance < 2.0 && distance > 0.5,
            "Short NYC distance should be ~1 km, got {distance}"
        );
    }

    #[test]
    fn test_haversine_crosses_dateline() {
        // Tokyo to Los Angeles crosses the Pacific / date line
        let distance = haversine_distance(TOKYO.0, TOKYO.1, LA.0, LA.1);
        assert!(
            distance > 8000.0 && distance < 9500.0,
            "Tokyo to LA should be ~8815 km, got {distance}"
        );
    }

    #[test]
    fn test_haversine_symmetric() {
        // Distance should be the same in both directions
        let d1 = haversine_distance(NYC.0, NYC.1, LONDON.0, LONDON.1);
        let d2 = haversine_distance(LONDON.0, LONDON.1, NYC.0, NYC.1);
        assert!(
            (d1 - d2).abs() < 0.001,
            "Distance should be symmetric: {d1} vs {d2}"
        );
    }

    #[test]
    fn test_valid_coordinates() {
        // Valid coordinates
        assert!(is_valid_coordinates(40.7128, -74.0060)); // NYC
        assert!(is_valid_coordinates(-33.8688, 151.2093)); // Sydney
        assert!(is_valid_coordinates(0.0, 0.0)); // Equator/Prime Meridian
        assert!(is_valid_coordinates(90.0, 180.0)); // North Pole
        assert!(is_valid_coordinates(-90.0, -180.0)); // South Pole
    }

    #[test]
    fn test_invalid_latitude() {
        assert!(!is_valid_coordinates(91.0, 0.0));
        assert!(!is_valid_coordinates(-91.0, 0.0));
        assert!(!is_valid_coordinates(100.0, 50.0));
    }

    #[test]
    fn test_invalid_longitude() {
        assert!(!is_valid_coordinates(0.0, 181.0));
        assert!(!is_valid_coordinates(0.0, -181.0));
        assert!(!is_valid_coordinates(45.0, 200.0));
    }

    #[test]
    fn test_invalid_nan() {
        assert!(!is_valid_coordinates(f64::NAN, 0.0));
        assert!(!is_valid_coordinates(0.0, f64::NAN));
        assert!(!is_valid_coordinates(f64::NAN, f64::NAN));
    }

    #[test]
    fn test_invalid_infinity() {
        assert!(!is_valid_coordinates(f64::INFINITY, 0.0));
        assert!(!is_valid_coordinates(0.0, f64::NEG_INFINITY));
    }

    #[test]
    fn test_calculate_speed() {
        // 100 km in 1 hour = 100 km/h
        assert_eq!(calculate_speed(100.0, 1.0), 100.0);

        // 1000 km in 2 hours = 500 km/h
        assert_eq!(calculate_speed(1000.0, 2.0), 500.0);

        // 5570 km in 7 hours (NYC to London flight) = ~796 km/h
        let speed = calculate_speed(5570.0, 7.0);
        assert!((speed - 795.7).abs() < 1.0);
    }

    #[test]
    fn test_calculate_speed_zero_time() {
        // Zero time = infinite speed (impossible)
        assert!(calculate_speed(100.0, 0.0).is_infinite());
    }

    #[test]
    fn test_calculate_speed_negative_time() {
        // Negative time = infinite speed (impossible)
        assert!(calculate_speed(100.0, -1.0).is_infinite());
    }
}
