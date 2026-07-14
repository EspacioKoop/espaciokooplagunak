#include "content/mapPreview.h"

#include <cmath>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <string>
#include <vector>

namespace
{
int checks = 0;

void expect(bool condition, const std::string& message)
{
    ++checks;
    if (!condition)
    {
        std::cerr << "FAIL: " << message << "\n";
        std::exit(1);
    }
}

MapObject object(std::string id, MapObjectKind kind, float x, float y, float size = 120.0f)
{
    MapObject result;
    result.id = std::move(id);
    result.kind = kind;
    result.transform = {x, y, 45.0f};
    result.size = size;
    return result;
}
}

int main()
{
    MapDocument document;
    document.objects.push_back(object("asteroid-a", MapObjectKind::Asteroid, 100.0f, -50.0f, 20.0f));
    document.objects.push_back(object("nebula-a", MapObjectKind::Nebula, -200.0f, 300.0f));
    MapObject future = object("future-a", MapObjectKind::Unsupported, 0.0f, 0.0f);
    future.opaque_json = R"({"id":"future-a","kind":"future","payload":{"safe":true}})";
    document.objects.push_back(std::move(future));

    std::vector<MapPreviewMarker> markers;
    expect(buildMapPreviewMarkers(document, 0.5f, markers) == MapDocumentError::None,
        "valid document projects");
    expect(markers.size() == 2, "unsupported objects are preserved by the model but omitted from preview");
    expect(markers[0].id == "asteroid-a" && markers[0].kind == MapPreviewMarkerKind::Asteroid,
        "asteroid marker keeps order and kind");
    expect(markers[0].x == 100.0f && markers[0].y == -50.0f && markers[0].rotation == 45.0f,
        "asteroid marker keeps transform");
    expect(markers[0].radius_pixels == 10.0f, "asteroid radius follows radar scale");
    expect(markers[1].id == "nebula-a" && markers[1].kind == MapPreviewMarkerKind::Nebula,
        "nebula marker keeps order and kind");
    expect(markers[1].radius_pixels == MAP_PREVIEW_NEBULA_RADIUS_PIXELS,
        "nebula uses a symbolic fixed marker");

    MapDocument tiny;
    tiny.objects.push_back(object("tiny", MapObjectKind::Asteroid, 0.0f, 0.0f, MAP_ASTEROID_MIN_SIZE));
    expect(buildMapPreviewMarkers(tiny, 0.0001f, markers) == MapDocumentError::None
            && markers[0].radius_pixels == MAP_PREVIEW_ASTEROID_MIN_RADIUS_PIXELS,
        "asteroid marker clamps minimum pixel radius");
    expect(buildMapPreviewMarkers(tiny, 100.0f, markers) == MapDocumentError::None
            && markers[0].radius_pixels == MAP_PREVIEW_ASTEROID_MAX_RADIUS_PIXELS,
        "asteroid marker clamps maximum pixel radius");

    const auto stable = markers;
    expect(buildMapPreviewMarkers(document, 0.0f, markers) == MapDocumentError::InvalidNumber,
        "zero scale rejected");
    expect(markers.size() == stable.size() && markers[0].id == stable[0].id,
        "invalid scale leaves output unchanged");
    expect(buildMapPreviewMarkers(document, std::numeric_limits<float>::quiet_NaN(), markers)
            == MapDocumentError::InvalidNumber,
        "non-finite scale rejected");

    MapDocument invalid = document;
    invalid.objects[1].id = "asteroid-a";
    expect(buildMapPreviewMarkers(invalid, 1.0f, markers) == MapDocumentError::DuplicateId,
        "invalid document rejected before projection");
    expect(markers.size() == stable.size() && markers[0].id == stable[0].id,
        "invalid document leaves output unchanged");

    std::cout << "MAP_PREVIEW_TESTS_OK checks=" << checks << "\n";
    return 0;
}
