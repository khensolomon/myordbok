"""
Sponsors Page Generator for the Myanmar Dictionary Project.

This script reads data and layout instructions from sponsors.json to generate
a complete SPONSORS.md file from scratch.

version: 2025.10.01.18

Changelog:
- 2025.10.01.18:
  - IMPROVED: The script now correctly counts *unique* anonymous donors
    within a group, preventing the same person from being counted multiple times.
- 2025.10.01.17:
  - IMPROVED: The '{year}' placeholder now correctly resolves to the actual
    year when using 'current_year' in filters.
  - ADDED: A new global '{current_year}' placeholder is available in summaries.
- 2025.10.01.16:
  - FIXED: Removed extra blank line that appeared before the footer section.
    Refactored the main generator loop for cleaner spacing logic.
- 2025.10.01.15:
  - ADDED: Blank lines are now generated before and after each heading
    in a 'groupBy' section for better readability.
- 2025.10.01.14:
  - FIXED: The footer title is now correctly formatted as an H2 heading
    instead of an H1.
- 2025.10.01.13:
  - UPDATED: The date format for the '{last_updated}' placeholder is now
    more readable (e.g., "October 1, 2025").
"""
import json
from datetime import datetime

# --- Data Processing & Formatting Helpers ---
def apply_filters(donations, filters, current_year):
    """Filters a list of donations based on a set of rules."""
    filtered = []
    for d in donations:
        matches = True
        for f in filters:
            field, cond, val = f['field'], f['condition'], f['value']
            d_val = d.get(field)
            if field == 'year':
                d_val = datetime.strptime(d['date'], '%Y-%m-%d').year
            if val == 'current_year':
                val = current_year
            if d_val is None:
                matches = False; break
            if cond == '==' and not d_val == val: matches = False
            elif cond == '>=' and not d_val >= val: matches = False
            elif cond == '<=' and not d_val <= val: matches = False
            if not matches: break
        if matches: filtered.append(d)
    return filtered

def format_donor_list(donations, donors_map, sort_by='date', sort_order='descending'):
    """Formats a list of donations into a markdown list of donor names."""
    unique_donors = {}
    anonymous_donor_ids = set() # Use a set to track unique anonymous donor IDs
    
    for d in donations:
        donor = donors_map.get(d['id'])
        if donor and not donor.get('displayConsent'):
            anonymous_donor_ids.add(donor['id']) # Add the ID to the set
        elif d['id'] not in unique_donors:
            unique_donors[d['id']] = d
    
    sorted_donations = sorted(list(unique_donors.values()), key=lambda d: d.get(sort_by, 0), reverse=(sort_order == 'descending'))
    
    lines = []
    for d in sorted_donations:
        donor = donors_map.get(d['id'])
        if donor:
            name, url, avatar = (donor['displayName'], donor.get('url'), donor.get('avatarUrl'))
            line = "- "
            if avatar: line += f'<img src="{avatar}" width="24" alt="{name}" style="border-radius:50%;"> '
            line += f'[{name}]({url})' if url else name
            lines.append(line)
    
    anonymous_count = len(anonymous_donor_ids) # The count is the number of unique IDs
    if anonymous_count > 0:
        if anonymous_count == 1:
            lines.append("- Anonymous")
        else:
            lines.append(f"- {anonymous_count} Anonymous")
            
    return "\n".join(lines) if lines else "_No supporters in this category yet._"

# --- Section Generator Functions (No changes from here down) ---

def generate_header_or_footer(section, all_donations, today):
    """Generates markdown for the header or footer section."""
    # The header gets an H1, the footer gets an H2
    heading_level = "#" if section.get('sectionType') == 'header' else "##"
    title = f"{heading_level} {section['title']}"
    
    desc = "\n".join(section.get('description', [])) if isinstance(section.get('description'), list) else section.get('description', '')
    
    total_amount = sum(d['amount'] for d in all_donations)
    placeholders = {
        'total_amount_usd': f"{total_amount:,.2f}",
        'total_contributions': str(len(all_donations)),
        'last_updated': today.strftime('%B %d, %Y')
    }
    final_desc = desc.format(**placeholders)
    
    return [title, "", final_desc]

def generate_summary_section(section, all_donations, current_year):
    """Generates markdown for a summary section."""
    content = []
    calculations = section.get('calculation', [])
    if not isinstance(calculations, list):
        calculations = [calculations]

    for calc in calculations:
        donations_for_calc = apply_filters(all_donations, calc.get('filters', []), current_year)
        if calc.get('type') == 'sum_amount':
            total = sum(d['amount'] for d in donations_for_calc)
            text = calc.get('displayText', "")
            placeholders = {
                'total_amount': f"{total:,.2f}",
                'count': len(donations_for_calc),
                'current_year': str(current_year)
            }
            for f in calc.get('filters', []):
                if f['field'] == 'year':
                    # Populate {year} with the correct value
                    if f['value'] == 'current_year':
                        placeholders['year'] = str(current_year)
                    else:
                        placeholders['year'] = str(f['value'])
            
            try:
                content.append(text.format(**placeholders))
            except KeyError as e:
                print(f"⚠️  Warning: Placeholder {e} in displayText not found for section '{section['title']}'.")
    return "\n".join(content)

def generate_donorlist_section(section, all_donations, processed_donations, donors_map, current_year):
    """Generates markdown for a donorList section."""
    content = []
    opts = section.get('displayOptions', {})
    format_args = {'donors_map': donors_map, 'sort_by': opts.get('sortBy', 'date'), 'sort_order': opts.get('sortOrder', 'descending')}
    
    if 'groupBy' in section:
        donations_for_grouping = [d for d in all_donations if id(d) not in processed_donations]
        groups = {}
        for d in donations_for_grouping:
            year = datetime.strptime(d['date'], '%Y-%m-%d').year
            if year not in groups: groups[year] = []
            groups[year].append(d)
            processed_donations.add(id(d))
        
        group_by_title_template = section.get('groupByTitle', "### Supporters from {year}")
        sorted_years = sorted(groups.keys(), reverse=True)
        for i, year in enumerate(sorted_years):
            # Add a blank line before the heading, but not for the very first one
            if i > 0:
                content.append("")
            
            content.append(group_by_title_template.format(year=year))
            content.append("")
            content.append(format_donor_list(groups[year], **format_args))
    else:
        remaining = [d for d in all_donations if id(d) not in processed_donations]
        section_donations = apply_filters(remaining, section.get('filters', []), current_year)
        for d in section_donations: processed_donations.add(id(d))
        content.append(format_donor_list(section_donations, **format_args))
    return "\n".join(content)

# --- Main Generator ---

def generate_sponsors_page():
    """Reads sponsors.json and generates SPONSORS.md."""
    try:
        with open("sponsors.json", "r", encoding="utf-8") as f: data = json.load(f)
    except FileNotFoundError:
        print("Error: sponsors.json not found."); return None

    donors_map = {d['id']: d for d in data.get('donors', [])}
    all_donations = data.get('donations', [])
    today = datetime.now()
    current_year = today.year

    md_output = []
    processed_donations = set()

    page_structure = data.get('page', [])
    
    # Filter out footer to handle it separately at the end
    main_content_sections = [s for s in page_structure if s.get('sectionType') != 'footer']

    for i, section in enumerate(main_content_sections):
        section_type = section.get('sectionType', 'donorList')
        generated_content = ""

        if section_type == 'header':
            generated_content = "\n".join(generate_header_or_footer(section, all_donations, today))
        
        else: # Standard sections (summary, donorList)
            title = f"## {section['title']}"
            description = section.get('description', [])
            
            section_parts = [title]
            
            if description:
                section_parts.append("")
                if isinstance(description, list):
                    section_parts.append("\n".join(description))
                else:
                    section_parts.append(description)

            if section_type == 'summary':
                summary_content = generate_summary_section(section, all_donations, current_year)
                if summary_content:
                    section_parts.append("")
                    section_parts.append(summary_content)

            elif section_type == 'donorList':
                donor_list_content = generate_donorlist_section(section, all_donations, processed_donations, donors_map, current_year)
                if donor_list_content:
                    section_parts.append("")
                    section_parts.append(donor_list_content)
            
            generated_content = "\n".join(section_parts)

        md_output.append(generated_content)

        # Add a blank line between sections, but not after the very last one
        if i < len(main_content_sections) - 1:
            md_output.append("")

    # Find and process the footer at the very end
    footer_section = next((s for s in page_structure if s.get('sectionType') == 'footer'), None)
    if footer_section:
        # Add a blank line before the footer if there was other content
        if md_output:
            md_output.append("")
        md_output.append("\n".join(generate_header_or_footer(footer_section, all_donations, today)))

    return "\n".join(md_output) + "\n"


if __name__ == "__main__":
    sponsors_md_content = generate_sponsors_page()
    
    if sponsors_md_content:
        # Write the standalone SPONSORS.md file
        with open("../SPONSORS.md", "w", encoding="utf-8") as f:
            f.write(sponsors_md_content)
        print("✅ Successfully generated SPONSORS.md!")

