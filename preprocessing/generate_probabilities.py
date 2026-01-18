#!/usr/bin/env python3
"""
NFL Probability Data Generator
Generates historical probability data from nflverse for the NFL Live Game Simulator
"""

import json
from datetime import datetime
import sys

try:
    import nfl_data_py as nfl
    import pandas as pd
except ImportError:
    print("Error: Required packages not installed")
    print("Please run: pip install nfl_data_py pandas")
    sys.exit(1)


def main():
    """Main function to generate probability data"""
    print("=" * 60)
    print("NFL Probability Data Generator")
    print("=" * 60)
    print()

    # Load play-by-play data
    print("Loading NFL play-by-play data...")
    pbp, current_season = load_play_by_play_data()

    if pbp is None:
        print("Error: Failed to load data")
        sys.exit(1)

    print(f"✓ Loaded {len(pbp):,} plays from {current_season} season")
    print()

    # Calculate probabilities
    print("Calculating probabilities...")
    print()

    print("  [1/4] League-wide conversion rates...")
    league_rates = calculate_league_rates(pbp)
    print(f"      ✓ Generated {len(league_rates)} league conversion rates")

    print("  [2/4] Team-specific conversion rates...")
    team_rates = calculate_team_rates(pbp)
    print(f"      ✓ Generated {len(team_rates)} team-specific rates")

    print("  [3/4] Field position impact...")
    field_position = calculate_field_position_impact(pbp)
    print(f"      ✓ Generated {len(field_position)} field position rates")

    print("  [4/4] Player success rates...")
    player_rates = calculate_player_rates(pbp)
    print(f"      ✓ Generated {len(player_rates)} player success rates")

    print()

    # Create output
    output = {
        'generated_at': datetime.now().isoformat(),
        'season': current_season,
        'total_plays': len(pbp),
        'league_conversion_rates': league_rates,
        'team_conversion_rates': team_rates,
        'field_position_impact': field_position,
        'player_success_rates': player_rates,
        'metadata': {
            'description': 'NFL probability data for live game simulator',
            'source': 'nflverse/nfl_data_py',
            'note': 'For entertainment purposes only'
        }
    }

    # Save to JSON
    output_path = '../probability-data.json'
    print(f"Saving to {output_path}...")

    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"✓ Saved probability data successfully")
    print()
    print("=" * 60)
    print("Summary:")
    print(f"  Season: {current_season}")
    print(f"  Total plays analyzed: {len(pbp):,}")
    print(f"  League conversion rates: {len(league_rates)}")
    print(f"  Team-specific rates: {len(team_rates)}")
    print(f"  Field position rates: {len(field_position)}")
    print(f"  Player success rates: {len(player_rates)}")
    print("=" * 60)
    print()
    print("✓ Done! You can now use the web application.")
    print()


def load_play_by_play_data():
    """Load play-by-play data from nflverse"""
    try:
        # Try current season first (2025)
        try:
            pbp_2025 = nfl.import_pbp_data([2025])
            current_season = 2025
            pbp = pbp_2025
            print(f"  Using 2025 season data")
        except:
            print("  2025 data not available, using 2024")
            pbp_2024 = nfl.import_pbp_data([2024])
            current_season = 2024
            pbp = pbp_2024

        # Filter to relevant plays
        pbp = pbp[pbp['play_type'].isin(['pass', 'run'])].copy()
        pbp = pbp[pbp['down'].isin([1, 2, 3, 4])].copy()

        # Handle missing first_down_converted column
        if 'first_down_converted' not in pbp.columns:
            # Create it based on other columns
            pbp['first_down_converted'] = (
                (pbp['first_down'] == 1) |
                (pbp['touchdown'] == 1)
            ).astype(int)

        return pbp, current_season

    except Exception as e:
        print(f"Error loading data: {e}")
        return None, None


def calculate_league_rates(pbp):
    """Calculate league-wide conversion rates by down, distance, and play type"""

    def distance_bucket(yards):
        if pd.isna(yards):
            return 'medium'
        if yards <= 3:
            return 'short'
        elif yards <= 6:
            return 'medium'
        elif yards <= 10:
            return 'long'
        else:
            return 'very_long'

    pbp['dist_bucket'] = pbp['ydstogo'].apply(distance_bucket)

    # Focus on 3rd and 4th downs
    third_fourth = pbp[pbp['down'].isin([3, 4])].copy()

    rates = third_fourth.groupby(['down', 'dist_bucket', 'play_type']).agg({
        'first_down_converted': 'mean',
        'play_id': 'count'
    }).reset_index()

    rates.columns = ['down', 'distance', 'play_type', 'success_rate', 'sample_size']

    # Filter out small sample sizes
    rates = rates[rates['sample_size'] >= 10]

    return rates.to_dict('records')


def calculate_team_rates(pbp):
    """Calculate team-specific conversion rates"""

    def distance_bucket(yards):
        if pd.isna(yards):
            return 'medium'
        if yards <= 3:
            return 'short'
        elif yards <= 6:
            return 'medium'
        elif yards <= 10:
            return 'long'
        else:
            return 'very_long'

    pbp['dist_bucket'] = pbp['ydstogo'].apply(distance_bucket)

    # Only 3rd downs
    third_downs = pbp[pbp['down'] == 3].copy()

    rates = third_downs.groupby(['posteam', 'dist_bucket', 'play_type']).agg({
        'first_down_converted': 'mean',
        'play_id': 'count'
    }).reset_index()

    rates.columns = ['team', 'distance', 'play_type', 'success_rate', 'sample_size']

    # Filter small samples
    rates = rates[rates['sample_size'] >= 5]

    # Remove null teams
    rates = rates[rates['team'].notna()]

    return rates.to_dict('records')


def calculate_field_position_impact(pbp):
    """Calculate how field position affects success rates"""

    def field_zone(yardline_100):
        if pd.isna(yardline_100):
            return 'mid_field'
        if yardline_100 <= 10:
            return 'red_zone'
        elif yardline_100 <= 20:
            return 'green_zone'
        elif yardline_100 <= 50:
            return 'mid_field'
        else:
            return 'own_territory'

    pbp['field_zone'] = pbp['yardline_100'].apply(field_zone)

    third_downs = pbp[pbp['down'] == 3].copy()

    # Check if touchdown column exists
    if 'touchdown' not in third_downs.columns:
        third_downs['touchdown'] = 0

    rates = third_downs.groupby(['field_zone', 'play_type']).agg({
        'first_down_converted': 'mean',
        'touchdown': 'mean',
        'play_id': 'count'
    }).reset_index()

    rates.columns = ['zone', 'play_type', 'conversion_rate', 'td_rate', 'sample_size']

    return rates.to_dict('records')


def calculate_player_rates(pbp):
    """Calculate success rates for top players"""

    # For receivers: targets on 3rd down
    third_down_passes = pbp[(pbp['down'] == 3) & (pbp['play_type'] == 'pass')].copy()

    # Check if required columns exist
    if 'receiver_player_id' not in third_down_passes.columns:
        print("    Warning: receiver_player_id column not found, skipping player stats")
        return []

    # Check if complete_pass column exists
    if 'complete_pass' not in third_down_passes.columns:
        third_down_passes['complete_pass'] = (third_down_passes['pass_length'].notna()).astype(int)

    receiver_stats = third_down_passes.groupby('receiver_player_id').agg({
        'receiver_player_name': 'first',
        'complete_pass': 'mean',
        'first_down_converted': 'mean',
        'play_id': 'count'
    }).reset_index()

    receiver_stats.columns = ['player_id', 'player_name', 'catch_rate', 'conversion_rate', 'targets']

    # Only players with 10+ targets
    receiver_stats = receiver_stats[receiver_stats['targets'] >= 10]

    # Remove null players
    receiver_stats = receiver_stats[receiver_stats['player_id'].notna()]
    receiver_stats = receiver_stats[receiver_stats['player_name'].notna()]

    # Sort by conversion rate, take top 50
    receiver_stats = receiver_stats.sort_values('conversion_rate', ascending=False).head(50)

    # For rushers: carries on 3rd down
    third_down_runs = pbp[(pbp['down'] == 3) & (pbp['play_type'] == 'run')].copy()

    rusher_data = []
    if 'rusher_player_id' in third_down_runs.columns:
        rusher_stats = third_down_runs.groupby('rusher_player_id').agg({
            'rusher_player_name': 'first',
            'first_down_converted': 'mean',
            'play_id': 'count'
        }).reset_index()

        rusher_stats.columns = ['player_id', 'player_name', 'conversion_rate', 'carries']

        rusher_stats = rusher_stats[rusher_stats['carries'] >= 10]
        rusher_stats = rusher_stats[rusher_stats['player_id'].notna()]
        rusher_stats = rusher_stats[rusher_stats['player_name'].notna()]
        rusher_stats = rusher_stats.sort_values('conversion_rate', ascending=False).head(50)

        rusher_stats['position'] = 'RB'
        rusher_data = rusher_stats[['player_id', 'player_name', 'position', 'conversion_rate']].to_dict('records')

    # Combine
    receiver_stats['position'] = 'WR'
    receiver_data = receiver_stats[['player_id', 'player_name', 'position', 'conversion_rate']].to_dict('records')

    return receiver_data + rusher_data


if __name__ == '__main__':
    main()
