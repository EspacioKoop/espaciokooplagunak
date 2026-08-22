#!/usr/share/doc/python3.11/README.md, /usr/share/doc/python3.11, /usr/share/doc/python3.11/README.md, /usr/share/doc/python3.11, /usr/share/doc/python3.11/README.md, /usr/share/doc/python3.11, /usr/share/doc/python3.11/README.md, /usr/share/doc/python3.#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Unit tests for tools/nasa3d.py
Tests use fixed responses, no network calls.
"""

import json
import os
import sys
import unittest
from unittest.mock import patch, mock_open

# Add the tools directory to the path so we can import nasa3d
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import nasa3d


class TestNasa3d(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures before each test method."""
        # Sample meta.json data based on NASA 3D Resources structure
        self.sample_meta = {
            "models": [
                {
                    "name": "Perseverance Rover",
                    "description": "NASA's Mars 2020 Perseverance Rover",
                    "category": "3D Models",
                    "files": [
                        {
                            "path": "3D Models/Mars 2020 Perseverance Rover/Mars 2020 Perseverance Rover.glb",
                            "size": 1234567
                        },
                        {
                            "path": "3D Models/Mars 2020 Perseverance Rover/Mars 2020 Perseverance Rover.stl",
                            "size": 890123
                        }
                    ]
                },
                {
                    "name": "Apollo 11 Landing Site",
                    "description": "The Apollo 11 landing site on the Moon",
                    "category": "3D Printing",
                    "files": [
                        {
                            "path": "3D Printing/Apollo 11 Landing Site/Apollo 11 Landing Site.stl",
                            "size": 456789
                        }
                    ]
                },
                {
                    "name": "Hubble Space Telescope",
                    "description": "NASA's Hubble Space Telescope",
                    "category": "3D Models",
                    "files": [
                        {
                            "path": "Images and Textures/Hubble/Hubble.texture",
                            "size": 12345
                        }
                    ]
                }
            ]
        }

    @patch('nasa3d._cargar_apis')
    @patch('builtins.open', new_callable=mock_open)
    def test_get_meta_json_from_cache(self, mock_file, mock_cargar_apis):
        """Test that _get_meta_json loads from cache when available."""
        # Mock the cache file existing and containing valid JSON
        mock_file.return_value.__enter__.return_value.read.return_value = json.dumps(self.sample_meta)
        
        # Mock os.path.exists to return True for the cache file
        with patch('nasa3d.os.path.exists') as mock_exists:
            mock_exists.return_value = True
            
            # Call the function
            result = nasa3d._get_meta_json()
            
            # Verify we got the expected data
            self.assertEqual(result, self.sample_meta)
            # Verify the API client was NOT called (since we used cache)
            mock_cargar_apis.assert_not_called()

    @patch('nasa3d._cargar_apis')
    def test_get_meta_json_from_github(self, mock_cargar_apis):
        """Test that _get_meta_json downloads from GitHub when cache is missing."""
        # Mock os.path.exists to return False for the cache file
        with patch('nasa3d.os.path.exists') as mock_exists:
            mock_exists.return_value = False
            
            # Mock the API client to return our sample data
            mock_apis_instance = mock_cargar_apis.return_value
            mock_apis_instance.pedir.return_value = json.dumps(self.sample_meta)
            
            # Call the function
            result = nasa3d._get_meta_json()
            
            # Verify we got the expected data
            self.assertEqual(result, self.sample_meta)
            # Verify the API client WAS called
            mock_cargar_apis.assert_called_once()
            mock_apis_instance.pedir.assert_called_once_with(
                'https://raw.githubusercontent.com/nasa/3D-Resources/master/meta.json'
            )

    def test_build_download_url(self):
        """Test that _build_download_url correctly converts paths to CDN URLs."""
        test_cases = [
            (
                "3D Models/Mars 2020 Perseverance Rover/Mars 2020 Perseverance Rover.glb",
                "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/model/mars-2020-perseverance-rover/Mars%202020%20Perseverance%20Rover.glb?emrc=auto"
            ),
            (
                "3D Printing/Apollo 11 Landing Site/Apollo 11 Landing Site.stl",
                "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/printable/apollo-11---landing-site/Apollo%2011%20Landing%20Site.stl?emrc=auto"
            ),
            (
                "Images and Textures/Hubble/Hubble.texture",
                "https://assets.science.nasa.gov/content/dam/science/cds/3d/resources/texture/hubble/Hubble.texture?emrc=auto"
            )
        ]
        
        for input_path, expected_url in test_cases:
            with self.subTest(input_path=input_path):
                result = nasa3d._build_download_url(input_path)
                self.assertEqual(result, expected_url)

    def test_build_model_page_url(self):
        """Test that _build_model_page_url constructs correct model page URLs."""
        test_cases = [
            ("Perseverance Rover", "https://science.nasa.gov/3d-resources/perseverance-rover/"),
            ("Apollo 11 Landing Site", "https://science.nasa.gov/3d-resources/apollo-11-landing-site/"),
            ("Hubble Space Telescope", "https://science.nasa.gov/3d-resources/hubble-space-telescope/"),
            ("James Webb Space Telescope", "https://science.nasa.gov/3d-resources/james-webb-space-telescope/")
        ]
        
        for model_name, expected_url in test_cases:
            with self.subTest(model_name=model_name):
                result = nasa3d._build_model_page_url(model_name)
                self.assertEqual(result, expected_url)

    @patch('nasa3d._get_meta_json')
    def test_buscar_modelos_no_query(self, mock_get_meta):
        """Test buscar_modelos with no query returns all models with files."""
        mock_get_meta.return_value = self.sample_meta
        
        results = nasa3d.buscar_modelos('')
        
        # Should return all 3 models (all have files)
        self.assertEqual(len(results), 3)
        
        # Check first result (Perseverance Rover)
        self.assertEqual(results[0]['titulo'], 'Perseverance Rover')
        self.assertEqual(results[0]['identificador'], 'Perseverance Rover')
        self.assertEqual(results[0]['licencia declarada'], 'Public Domain')
        # URL de la ficha should use slug format: lowercase, spaces to hyphens
        self.assertIn('perseverance-rover', results[0]['url de la ficha'])
        self.assertIn('.glb', results[0]['url del fichero'])  # Should prefer GLB
        
        # Check second result (Apollo 11 Landing Site)
        self.assertEqual(results[1]['titulo'], 'Apollo 11 Landing Site')
        self.assertEqual(results[1]['identificador'], 'Apollo 11 Landing Site')
        self.assertEqual(results[1]['licencia declarada'], 'Public Domain')
        # URL de la ficha should use slug format: lowercase, spaces to hyphens
        self.assertIn('apollo-11-landing-site', results[1]['url de la ficha'])
        self.assertIn('.stl', results[1]['url del fichero'])  # Should use STL (no GLB)
        
        # Check third result (Hubble Space Telescope)
        self.assertEqual(results[2]['titulo'], 'Hubble Space Telescope')
        self.assertEqual(results[2]['identificador'], 'Hubble Space Telescope')
        self.assertEqual(results[2]['licencia declarada'], 'Public Domain')
        # URL de la ficha should use slug format: lowercase, spaces to hyphens
        self.assertIn('hubble-space-telescope', results[2]['url de la ficha'])
        self.assertIn('.texture', results[2]['url del fichero'])  # First file since no GLB/STL

    @patch('nasa3d._get_meta_json')
    def test_buscar_modelos_with_query(self, mock_get_meta):
        """Test buscar_modelos with a query filters results correctly."""
        mock_get_meta.return_value = self.sample_meta
        
        # Search for "perseverance"
        results = nasa3d.buscar_modelos('perseverance')
        
        # Should return only the Perseverance Rover model
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['titulo'], 'Perseverance Rover')
        
        # Search for "apollo"
        results = nasa3d.buscar_modelos('apollo')
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['titulo'], 'Apollo 11 Landing Site')
        
        # Search for something that doesn't exist
        results = nasa3d.buscar_modelos('nonexistent')
        self.assertEqual(len(results), 0)

    @patch('nasa3d._get_meta_json')
    def test_buscar_modelos_no_files(self, mock_get_meta):
        """Test buscar_modelos skips models with no files."""
        # Meta data with a model that has no files
        meta_no_files = {
            "models": [
                {
                    "name": "Empty Model",
                    "description": "A model with no downloadable files",
                    "category": "3D Models",
                    "files": []  # Empty files list
                },
                {
                    "name": "Valid Model",
                    "description": "A model with files",
                    "category": "3D Models",
                    "files": [
                        {
                            "path": "3D Models/Valid Model/Valid Model.glb",
                            "size": 12345
                        }
                    ]
                }
            ]
        }
        mock_get_meta.return_value = meta_no_files
        
        results = nasa3d.buscar_modelos('')
        
        # Should return only the valid model
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['titulo'], 'Valid Model')

    @patch('nasa3d._get_meta_json')
    def test_buscar_modelos_error_handling(self, mock_get_meta):
        """Test buscar_modelos handles errors gracefully."""
        # Simulate _get_meta_json raising an exception
        mock_get_meta.side_effect = RuntimeError('API error')
        
        # Should return empty list and print error to stderr
        with patch('sys.stderr') as mock_stderr:
            results = nasa3d.buscar_modelos('test')
            self.assertEqual(results, [])
            # Check that error was printed to stderr
            mock_stderr.write.assert_called()

    def test_main_with_desde_fichero(self):
        """Test main function with --desde-fichero argument."""
        # Create a temporary meta.json file for testing
        test_meta = {
            "models": [
                {
                    "name": "Test Model",
                    "description": "A test model",
                    "category": "3D Models",
                    "files": [
                        {
                            "path": "3D Models/Test Model/Test Model.glb",
                            "size": 12345
                        }
                    ]
                }
            ]
        }
        
        with patch('sys.argv', ['nasa3d.py', '--desde-fichero', 'test.json']):
            with patch('builtins.open', mock_open(read_data=json.dumps(test_meta))) as mock_file:
                with patch('nasa3d.buscar_modelos') as mock_buscar:
                    mock_buscar.return_value = [{'titulo': 'Test Model'}]
                    with patch('sys.stdout') as mock_stdout:
                        try:
                            nasa3d.main()
                        except SystemExit:
                            pass  # main() calls sys.exit() after printing JSON
                        
                        # Verify the test file was opened
                        mock_file.assert_called_with('test.json', 'r', encoding='utf-8')
                        # Verify buscar_modelos was called with empty query (default)
                        mock_buscar.assert_called_with('')
                        # Verify JSON was dumped to stdout
                        mock_stdout.write.assert_called()

    def test_main_with_query(self):
        """Test main function with a search query."""
        with patch('sys.argv', ['nasa3d.py', 'perseverance']):
            with patch('nasa3d.buscar_modelos') as mock_buscar:
                mock_buscar.return_value = [{'titulo': 'Perseverance Rover'}]
                with patch('sys.stdout') as mock_stdout:
                    try:
                        nasa3d.main()
                    except SystemExit:
                        pass  # main() calls sys.exit() after printing JSON
                    
                    # Verify buscar_modelos was called with the query
                    mock_buscar.assert_called_with('perseverance')
                    # Verify JSON was dumped to stdout
                    mock_stdout.write.assert_called()


if __name__ == '__main__':
    unittest.main()