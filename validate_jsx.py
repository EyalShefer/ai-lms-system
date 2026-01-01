
import re

def validate_jsx(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    stack = []
    # Simplified regex for finding open/close tags
    # Ignores self-closing <div /> or <img /> etc
    # Captures <div ...>, </div>, <Fragment>, </Fragment>
    tag_re = re.compile(r'</?(\w+)(\s[^>]*)?/?>')
    
    # Range to check: The map loop
    # Starts around 1287: {editedUnit.activityBlocks.map
    # Ends around 1894
    
    start_line = 1280
    end_line = 1900
    
    for i, line in enumerate(lines):
        if i < start_line or i > end_line:
            continue
            
        # Remove strings to avoid parsing violations inside strings
        line_clean = re.sub(r'([\'"]).*?\1', '', line)
        
        matches = tag_re.finditer(line_clean)
        for match in matches:
            full_tag = match.group(0)
            tag_name = match.group(1)
            
            # Skip self-closing void elements or standard self-closing
            if full_tag.endswith('/>') or full_tag.endswith('/>'):
                continue
            if tag_name in ['img', 'input', 'hr', 'br', 'source', 'InsertMenu', 'InspectorBadge', 'IconSparkles', 'IconEdit', 'IconList', 'IconLayer', 'IconBrain', 'IconClock', 'IconTrash', 'IconCheck', 'IconBalance', 'IconUpload', 'IconPalette', 'IconWand', 'IconLink', 'IconHeadphones', 'IconBook', 'IconLoader', 'IconMicrophone', 'IconShield', 'IconRobot', 'IconLock']:
                continue

            if full_tag.startswith('</'):
                # Closing tag
                if not stack:
                    print(f"Error at line {i+1}: Unexpected closing tag </{tag_name}>")
                    continue
                
                last_tag = stack[-1]
                if last_tag['name'] == tag_name:
                    stack.pop()
                else:
                    # Special case for React.Fragment
                    if tag_name == 'React.Fragment' and last_tag['name'] == 'React.Fragment':
                         stack.pop()
                    else:
                        print(f"Error at line {i+1}: Expected </{last_tag['name']}> but found </{tag_name}>")
                        # Don't pop to show context? or pop to continue?
                        # stack.pop() 
            else:
                # Opening tag
                # Check if it's not a self-closing implicit one
                stack.append({'name': tag_name, 'line': i+1})

    if stack:
        print("Unclosed tags remaining:")
        for tag in stack:
            print(f"  <{tag['name']}> at line {tag['line']}")

validate_jsx('c:/Users/eyal.BONUS/Desktop/ai-lms-system/src/components/UnitEditor.tsx')
