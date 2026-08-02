import React, {useEffect, useState} from 'react';
import {
    Dimensions,
    Modal,
    Pressable,
    Share,
    StyleSheet,
    Text,
    ToastAndroid,
    TouchableOpacity,
    View,
    NativeModules,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useAppTheme} from '../theme/ThemeContext';
import {useTranslation} from 'react-i18next';

const MENU_WIDTH = 184;
const MENU_ROW_HEIGHT = 50;
const MENU_PADDING = 8;
const MENU_HEIGHT = MENU_ROW_HEIGHT * 2 + MENU_PADDING * 2;

interface Props {
    visible: boolean;
    x: number; // 长按位置（屏幕坐标）
    y: number;
    content: string;
    onClose: () => void;
    onSelectText: (text: string) => void;
}

/**
 * 长按消息后弹出的自定义操作菜单（跟随应用主题风格）
 * 一级：复制 / 分享；点"复制"后进入二级：选择文本 / 复制全部
 */
const MessageActionMenu = ({visible, x, y, content, onClose, onSelectText}: Props) => {
    const theme = useAppTheme();
    const {t} = useTranslation();
    const [level, setLevel] = useState<1 | 2>(1);

    // 每次打开时重置到一级菜单
    useEffect(() => {
        if (visible) {
            setLevel(1);
        }
    }, [visible]);

    // 计算菜单位置：优先显示在手指下方，空间不足则移到上方，并防止超出屏幕
    const {width: screenW, height: screenH} = Dimensions.get('window');
    let left = Math.min(x, screenW - MENU_WIDTH - 8);
    left = Math.max(left, 8);
    let top = y + 14;
    if (top + MENU_HEIGHT > screenH) {
        top = Math.max(8, y - MENU_HEIGHT - 14);
    }

    const copyAll = () => {
        try {
            NativeModules.ClipboardModule.copyToClipboard(content);
            ToastAndroid.show(t('copiedToClipboard'), ToastAndroid.SHORT);
        } catch (e) {
            // ignore
        }
        onClose();
    };

    const share = () => {
        Share.share({message: content}).catch(() => {
            // ignore
        });
        onClose();
    };

    const pickSelectText = () => {
        onSelectText(content);
        onClose();
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <View
                    style={[
                        styles.menu,
                        {
                            left,
                            top,
                            backgroundColor: theme.colors.surfaceContainerLow,
                            shadowColor: theme.colors.scrim,
                        },
                    ]}>
                    {level === 1 ? (
                        <>
                            <TouchableOpacity
                                style={styles.item}
                                activeOpacity={0.7}
                                onPress={() => setLevel(2)}>
                                <Icon name="content-copy" size={20} color={theme.colors.onSurfaceVariant}/>
                                <Text style={[styles.itemText, {color: theme.colors.onSurface}]}>
                                    {t('copy')}
                                </Text>
                            </TouchableOpacity>
                            <View style={[styles.divider, {backgroundColor: theme.colors.surfaceContainerHighest}]}/>
                            <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={share}>
                                <Icon name="share" size={20} color={theme.colors.onSurfaceVariant}/>
                                <Text style={[styles.itemText, {color: theme.colors.onSurface}]}>
                                    {t('share')}
                                </Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={styles.item}
                                activeOpacity={0.7}
                                onPress={pickSelectText}>
                                <Icon name="text-fields" size={20} color={theme.colors.onSurfaceVariant}/>
                                <Text style={[styles.itemText, {color: theme.colors.onSurface}]}>
                                    {t('selectText')}
                                </Text>
                            </TouchableOpacity>
                            <View style={[styles.divider, {backgroundColor: theme.colors.surfaceContainerHighest}]}/>
                            <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={copyAll}>
                                <Icon name="select-all" size={20} color={theme.colors.onSurfaceVariant}/>
                                <Text style={[styles.itemText, {color: theme.colors.onSurface}]}>
                                    {t('copyAll')}
                                </Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    menu: {
        position: 'absolute',
        width: MENU_WIDTH,
        borderRadius: 14,
        paddingVertical: MENU_PADDING,
        elevation: 8,
        shadowOpacity: 0.3,
        shadowRadius: 12,
        shadowOffset: {width: 0, height: 4},
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        height: MENU_ROW_HEIGHT,
        paddingHorizontal: 16,
        gap: 12,
    },
    itemText: {
        fontSize: 15,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: 12,
    },
});

export default MessageActionMenu;
