#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Tests for tools/srd2014.py
"""

import json
import os
import tempfile
import unittest
from unittest.mock import patch, mock_open

# Import the module to test
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import tools.srd2014 as srd2014

# Fixture: a truncated version of the real goblin response from dnd5eapi.co
REAL_GOBLIN_FIXTURE = {
    "index": "goblin",
    "name": "Goblin",
    "size": "Small",
    "type": "humanoid",
    "subtype": "goblinoid",
    "alignment": "neutral evil",
    "armor_class": [{"type": "armor", "value": 15, "armor": [{"index": "leather-armor", "name": "Leather Armor", "url": "/api/2014/equipment/leather-armor"}]}],
    "hit_points": 7,
    "hit_dice": "2d6",
    "speed": {"walk": "30 ft."},
    "strength": 8,
    "dexterity": 14,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 8,
    "charisma": 8,
    "challenge_rating": 0.25,
    "proficiency_bonus": 2,
    "xp": 50,
    "special_abilities": [{"name": "Nimble Escape", "desc": "The goblin can take the Disengage or Hide action as a bonus action on each of its turns.", "damage": []}],
    "actions": [{"name": "Scimitar", "desc": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.", "attack_bonus": 4, "damage": [{"damage_type": {"index": "slashing", "name": "Slashing", "url": "/api/2014/damage-types/slashing"}, "damage_dice": "1d6+2"}], "actions": []}],
    "image": "/api/images/monsters/goblin.png",
    "url": "/api/2014/monsters/goblin",
    "updated_at": "2026-04-01T20:35:38.254Z"
}

class TestSrd2014(unittest.TestCase):

    def test_add_attribution_dict(self):
        """Test that add_attribution adds the _attribution field to a dict."""
        result = srd2014.add_attribution(REAL_GOBLIN_FIXTURE)
        self.assertIn('_attribution', result)
        self.assertEqual(result['_attribution']['source'], 'dnd5eapi.co')
        self.assertEqual(result['_attribution']['license'], 'CC-BY-4.0')
        self.assertEqual(result['_attribution']['url'], 'https://www.dnd5eapi.co')
        # Ensure original data is still there
        self.assertEqual(result['name'], 'Goblin')

    def test_add_attribution_list(self):
        """Test that add_attribution wraps a list in a dict with _attribution and results."""
        data_list = [REAL_GOBLIN_FIXTURE, {"index": "orc", "name": "Orc"}]
        result = srd2014.add_attribution(data_list)
        self.assertIn('_attribution', result)
        self.assertIn('results', result)
        self.assertEqual(len(result['results']), 2)
        self.assertEqual(result['results'][0]['name'], 'Goblin')

    def test_get_attribution(self):
        """Test that get_attribution returns the expected string."""
        attribution = srd2014.get_attribution()
        self.assertEqual(attribution, "Source: dnd5eapi.co (CC-BY-4.0)")

    def test_pedir_a_srd_invalid_route(self):
        """Test that pedir_a_srd raises ValueError for routes not starting with /api/2014/."""
        with self.assertRaises(ValueError) as cm:
            srd2014.pedir_a_srd('/api/2024/monsters/goblin')
        self.assertIn('La ruta debe comenzar con /api/2014/', str(cm.exception))

        with self.assertRaises(ValueError) as cm:
            srd2014.pedir_a_srd('/api/2013/monsters/goblin')
        self.assertIn('La ruta debe comenzar con /api/2014/', str(cm.exception))

        with self.assertRaises(ValueError) as cm:
            srd2014.pedir_a_srd('/api/2014monsters/goblin')  # missing slash
        self.assertIn('La ruta debe comenzar con /api/2014/', str(cm.exception))

    @patch('tools.srd2014._cargar_apis')
    def test_pedir_a_srd_uses_cache(self, mock_cargar_apis):
        """Test that pedir_a_srd uses cache when available."""
        # Create a temporary directory and cache file
        with tempfile.TemporaryDirectory() as tmpdir:
            cache_path = os.path.join(tmpdir, '.srd2014_cache.json')
            # Write the fixture data to the cache file
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(REAL_GOBLIN_FIXTURE, f)
            # Patch the CACHE_FILE constant in the module to point to our temporary cache
            with patch.object(srd2014, 'CACHE_FILE', cache_path):
                # We don't need to mock _cargar_apis because we won't call the API
                result = srd2014.pedir_a_srd('/api/2014/monsters/goblin')
                # Since we are using cache, the function should return the cached data
                self.assertEqual(result, REAL_GOBLIN_FIXTURE)
                # The API's pedir method should not have been called
                mock_cargar_apis.assert_not_called()

    @patch('tools.srd2014._cargar_apis')
    def test_pedir_a_srd_fetch_and_cache(self, mock_cargar_apis):
        """Test that pedir_a_srd fetches and caches when cache doesn't exist."""
        # Mock the API client
        mock_apis = mock_cargar_apis.return_value
        mock_apis.pedir.return_value = REAL_GOBLIN_FIXTURE
        # Create a temporary directory; ensure cache file does not exist
        with tempfile.TemporaryDirectory() as tmpdir:
            cache_path = os.path.join(tmpdir, '.srd2014_cache.json')
            # Make sure the cache file does not exist
            if os.path.exists(cache_path):
                os.remove(cache_path)
            # Patch the CACHE_FILE constant in the module
            with patch.object(srd2014, 'CACHE_FILE', cache_path):
                result = srd2014.pedir_a_srd('/api/2014/monsters/goblin')
                self.assertEqual(result, REAL_GOBLIN_FIXTURE)
                # The API's pedir method should have been called
                mock_apis.pedir.assert_called_once_with('https://www.dnd5eapi.co/api/2014/monsters/goblin')
                # Check that a cache file was created
                self.assertTrue(os.path.exists(cache_path))
                # Optionally, check the content of the cache file
                with open(cache_path, 'r', encoding='utf-8') as f:
                    cached_data = json.load(f)
                self.assertEqual(cached_data, REAL_GOBLIN_FIXTURE)

if __name__ == '__main__':
    unittest.main()